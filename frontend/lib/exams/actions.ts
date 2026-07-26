'use server'

import { revalidatePath } from 'next/cache'

import { requireRole } from '@/lib/auth'
import { classBelongsToAcademy } from '@/lib/classes/service'
import { dispatchExamNotifications } from '@/lib/notifications/service'
import { createClient } from '@/lib/supabase/server'

import {
  createExamSchema,
  examIdSchema,
  saveScoresSchema,
  updateExamSchema,
} from './schemas'

function revalidateExamLists() {
  revalidatePath('/owner/exams')
  revalidatePath('/teacher/exams')
}

function revalidateExamDetail(examId: string) {
  revalidatePath(`/owner/exams/${examId}`)
  revalidatePath(`/teacher/exams/${examId}`)
}

function revalidateDashboards() {
  revalidatePath('/owner')
  revalidatePath('/teacher')
  revalidatePath('/me')
  revalidatePath('/me/exams')
}

/** 대상 시험이 내 학원 것인지 재검증 (RLS 위 2차 방어선). 통과 시 필요한 필드 반환. */
async function verifyExamInMyAcademy(examId: string): Promise<{
  academy_id: string
  class_id: string
  exam_date: string
  max_score: number
  published_at: string | null
}> {
  const user = await requireRole(['owner', 'teacher'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exams')
    .select('academy_id, class_id, exam_date, max_score, published_at')
    .eq('id', examId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.academy_id !== user.academyId) throw new Error('권한이 없습니다.')
  return data
}

export async function createExamAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')

  const parsed = createExamSchema.parse({
    class_id: formData.get('class_id') ?? '',
    title: formData.get('title'),
    exam_type: formData.get('exam_type'),
    scope: formData.get('scope'),
    exam_date: formData.get('exam_date') ?? '',
    max_score: formData.get('max_score'),
  })

  // 내 학원 반인지 재검증 — 소유 도메인 service 경유 (materials 선례)
  if (!(await classBelongsToAcademy(parsed.class_id, user.academyId))) {
    throw new Error('잘못된 반입니다.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('exams').insert({
    academy_id: user.academyId,
    class_id: parsed.class_id,
    title: parsed.title,
    exam_type: parsed.exam_type,
    scope: parsed.scope,
    exam_date: parsed.exam_date,
    max_score: parsed.max_score,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)

  revalidateExamLists()
}

export async function updateExamAction(formData: FormData) {
  const parsed = updateExamSchema.parse({
    id: formData.get('id') ?? '',
    title: formData.get('title'),
    exam_type: formData.get('exam_type'),
    scope: formData.get('scope'),
    exam_date: formData.get('exam_date') ?? '',
    max_score: formData.get('max_score'),
  })

  await verifyExamInMyAcademy(parsed.id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('exams')
    .update({
      title: parsed.title,
      exam_type: parsed.exam_type,
      scope: parsed.scope,
      exam_date: parsed.exam_date,
      max_score: parsed.max_score,
    })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)

  revalidateExamLists()
  revalidateExamDetail(parsed.id)
  revalidateDashboards()
}

export async function deleteExamAction(formData: FormData) {
  const id = examIdSchema.parse(formData.get('id') ?? '')
  await verifyExamInMyAcademy(id)

  const supabase = await createClient()
  const { error } = await supabase.from('exams').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidateExamLists()
  revalidateDashboards()
}

export async function saveExamScoresAction(formData: FormData) {
  const rawRows = formData.get('rows')
  const parsed = saveScoresSchema.parse({
    exam_id: formData.get('exam_id') ?? '',
    rows: typeof rawRows === 'string' && rawRows.trim() !== '' ? JSON.parse(rawRows) : [],
  })

  const exam = await verifyExamInMyAcademy(parsed.exam_id)
  const supabase = await createClient()

  // 명단 검증 — 제출된 student_id가 "시험일 기준" 그 반 명단에 있는지.
  // RLS는 "내 학원 행"까지만 막고 "이 시험의 응시자인가"는 보지 못한다. 검증이 없으면
  // 같은 학원 다른 반 학생 id를 끼워 넣어 점수를 심을 수 있다.
  const { data: rosterRows, error: rosterErr } = await supabase
    .from('class_students')
    .select('student_id, joined_at, left_at')
    .eq('class_id', exam.class_id)
  if (rosterErr) throw new Error(rosterErr.message)

  const allowed = new Set(
    (rosterRows ?? [])
      .filter(
        (cs) =>
          cs.joined_at <= exam.exam_date &&
          (cs.left_at === null || cs.left_at >= exam.exam_date)
      )
      .map((cs) => cs.student_id)
  )
  if (parsed.rows.some((r) => !allowed.has(r.student_id))) {
    throw new Error('이 시험의 응시 대상이 아닌 학생이 포함되어 있습니다.')
  }

  // 만점 초과 — 사용자에게 즉시 보여줄 메시지용. DB 트리거가 최후 방어선으로 한 겹 더 있다.
  const over = parsed.rows.find((r) => r.score !== null && r.score > exam.max_score)
  if (over) {
    throw new Error(`만점 ${exam.max_score}점을 넘는 점수가 있습니다.`)
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from('exam_scores').upsert(
    parsed.rows.map((r) => ({
      exam_id: parsed.exam_id,
      student_id: r.student_id,
      academy_id: exam.academy_id,
      class_id: exam.class_id,
      score: r.score,
      is_absent: r.is_absent,
      memo: r.memo,
      updated_at: now,
    })),
    { onConflict: 'exam_id,student_id' }
  )
  if (error) throw new Error(error.message)

  revalidateExamLists()
  revalidateExamDetail(parsed.exam_id)
}

/**
 * 공개. 멱등 — 이미 공개된 시험은 조용히 종료해 알림 중복을 막는다.
 * 알림 실패는 삼킨다: 공개가 주 작업이고 알림은 부수 효과다. throw하면 화면에는 "실패"가
 * 뜨는데 성적은 이미 공개된 상태라 사용자가 다시 누르게 되고, 그러면 알림이 두 번 갈 수 있다.
 * (materials는 throw하는데, 이 지점에서 의도적으로 다르게 간다 — 스펙 4.1 참조)
 * 반환값의 notified=false를 폼이 받아 "공개됐지만 알림 발송에 실패했습니다"를 표시한다.
 */
export async function publishExamAction(
  formData: FormData
): Promise<{ published: boolean; notified: boolean }> {
  const id = examIdSchema.parse(formData.get('id') ?? '')
  const exam = await verifyExamInMyAcademy(id)

  if (exam.published_at !== null) {
    return { published: true, notified: true }
  }

  const supabase = await createClient()

  // 미입력 검사 — 시험일 기준 명단 대비 점수·미응시가 모두 기록됐는지
  const [rosterRes, scoreRes] = await Promise.all([
    supabase
      .from('class_students')
      .select('student_id, joined_at, left_at')
      .eq('class_id', exam.class_id),
    supabase.from('exam_scores').select('student_id, score, is_absent').eq('exam_id', id),
  ])
  if (rosterRes.error) throw new Error(rosterRes.error.message)
  if (scoreRes.error) throw new Error(scoreRes.error.message)

  const rosterIds = (rosterRes.data ?? [])
    .filter(
      (cs) =>
        cs.joined_at <= exam.exam_date &&
        (cs.left_at === null || cs.left_at >= exam.exam_date)
    )
    .map((cs) => cs.student_id)
  const recorded = new Set(
    (scoreRes.data ?? [])
      .filter((s) => s.score !== null || s.is_absent)
      .map((s) => s.student_id)
  )
  const missing = rosterIds.filter((sid) => !recorded.has(sid)).length
  if (missing > 0) {
    throw new Error(`미입력 ${missing}명이 있습니다. 점수를 넣거나 미응시로 표시해주세요.`)
  }

  const { error } = await supabase
    .from('exams')
    .update({ published_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  let notified = true
  try {
    await dispatchExamNotifications(id, ['student', 'parent'])
  } catch {
    notified = false
  }

  revalidateExamLists()
  revalidateExamDetail(id)
  revalidateDashboards()

  return { published: true, notified }
}
