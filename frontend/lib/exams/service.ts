import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth'
import type {
  ExamListRow,
  ExamReportRow,
  ExamRosterRow,
  ExamStats,
  ExamWithClass,
  ExamWithRoster,
} from './types'
import { REPORT_MONTHS } from './types'

const COLS =
  'id, academy_id, class_id, title, exam_type, scope, exam_date, max_score, published_at, created_by, created_at'

type JoinedExam = Omit<ExamWithClass, 'class_name'> & {
  classes: { name: string } | { name: string }[] | null
}

function withClassName(row: JoinedExam): ExamWithClass {
  const { classes, ...rest } = row
  const cls = Array.isArray(classes) ? classes[0] : classes
  return { ...rest, class_name: cls?.name ?? null }
}

/** 시험일 기준 그 반 명단인가. class_students 이력(joined_at/left_at)을 그대로 해석. */
function inRosterOn(
  cs: { joined_at: string; left_at: string | null },
  examDate: string
): boolean {
  return cs.joined_at <= examDate && (cs.left_at === null || cs.left_at >= examDate)
}

/**
 * 스태프 목록. RLS가 범위를 적용한다 — owner는 학원 전체, teacher는 담당 반.
 * classId를 주면 그 반만 (반 상세에서 `?class=`로 진입하는 경로).
 * 최신 시험일 순.
 */
export async function listExamsForStaff(classId?: string): Promise<ExamListRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('exams')
    .select(`${COLS}, classes(name)`)
    .order('exam_date', { ascending: false })
  if (classId) query = query.eq('class_id', classId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const exams = (data ?? []).map((r) => withClassName(r as unknown as JoinedExam))
  if (exams.length === 0) return []

  const classIds = [...new Set(exams.map((e) => e.class_id))]
  const examIds = exams.map((e) => e.id)

  const [rosterRes, scoreRes] = await Promise.all([
    supabase
      .from('class_students')
      .select('class_id, student_id, joined_at, left_at')
      .in('class_id', classIds),
    supabase.from('exam_scores').select('exam_id, score, is_absent').in('exam_id', examIds),
  ])
  if (rosterRes.error) throw new Error(rosterRes.error.message)
  if (scoreRes.error) throw new Error(scoreRes.error.message)

  const roster = rosterRes.data ?? []
  const scores = scoreRes.data ?? []

  return exams.map((e) => {
    const rosterCount = roster.filter(
      (cs) => cs.class_id === e.class_id && inRosterOn(cs, e.exam_date)
    ).length
    const recordedCount = scores.filter(
      (s) => s.exam_id === e.id && (s.score !== null || s.is_absent)
    ).length
    return { ...e, roster_count: rosterCount, recorded_count: recordedCount }
  })
}

/** 점수 입력 화면 — 시험 + 시험일 기준 명단 + 이미 저장된 점수. 없는 시험이면 null. */
export async function getExamWithRoster(examId: string): Promise<ExamWithRoster | null> {
  const supabase = await createClient()

  const { data: examRow, error: examErr } = await supabase
    .from('exams')
    .select(`${COLS}, classes(name)`)
    .eq('id', examId)
    .maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!examRow) return null

  const exam = withClassName(examRow as unknown as JoinedExam)

  const [rosterRes, scoreRes] = await Promise.all([
    supabase
      .from('class_students')
      .select('student_id, joined_at, left_at, students(name)')
      .eq('class_id', exam.class_id),
    supabase
      .from('exam_scores')
      .select('student_id, score, is_absent, memo')
      .eq('exam_id', examId),
  ])
  if (rosterRes.error) throw new Error(rosterRes.error.message)
  if (scoreRes.error) throw new Error(scoreRes.error.message)

  const scoreByStudent = new Map(
    (scoreRes.data ?? []).map((s) => [s.student_id, s])
  )

  const roster: ExamRosterRow[] = (rosterRes.data ?? [])
    .filter((cs) => inRosterOn(cs, exam.exam_date))
    .map((cs) => {
      const student = Array.isArray(cs.students) ? cs.students[0] : cs.students
      const saved = scoreByStudent.get(cs.student_id)
      return {
        student_id: cs.student_id,
        student_name: student?.name ?? '(이름 없음)',
        score: saved?.score ?? null,
        is_absent: saved?.is_absent ?? false,
        memo: saved?.memo ?? null,
      }
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name, 'ko'))

  return { exam, roster }
}

/**
 * 스태프용 반 통계. 스태프는 RLS로 점수 행 전체를 읽을 수 있으므로 RPC가 필요 없다.
 * 실제 응시자(점수 있음 + 미응시 아님)만 집계.
 */
export async function getExamStats(examId: string): Promise<ExamStats> {
  const supabase = await createClient()

  const { data: exam, error: examErr } = await supabase
    .from('exams')
    .select('max_score')
    .eq('id', examId)
    .maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!exam) return { avg_pct: null, max_pct: null, taker_count: 0 }

  const { data, error } = await supabase
    .from('exam_scores')
    .select('score')
    .eq('exam_id', examId)
    .eq('is_absent', false)
    .not('score', 'is', null)
  if (error) throw new Error(error.message)

  const scores = (data ?? []).map((r) => r.score as number)
  if (scores.length === 0) return { avg_pct: null, max_pct: null, taker_count: 0 }

  const pcts = scores.map((s) => (s / exam.max_score) * 100)
  const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length
  return {
    avg_pct: Math.round(avg * 10) / 10,
    max_pct: Math.round(Math.max(...pcts) * 10) / 10,
    taker_count: scores.length,
  }
}

/** ISO 날짜 문자열(YYYY-MM-DD)로 최근 N개월 구간. */
function reportRange(months = REPORT_MONTHS): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setMonth(from.getMonth() - months)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/**
 * 학생·학부모 리포트. 개별 타인 점수를 노출하지 않기 위해 집계 RPC 경유.
 * 비인가 호출은 RPC가 빈 결과를 준다(에러 아님) — 학생 존재 여부도 누설하지 않는다.
 */
export async function getExamReport(studentId: string): Promise<ExamReportRow[]> {
  const supabase = await createClient()
  const { from, to } = reportRange()
  const { data, error } = await supabase.rpc('exam_report_for_student', {
    p_student_id: studentId,
    p_from: from,
    p_to: to,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ExamReportRow[]
}

/** 유형 입력칸 datalist 추천값 — 학원 내 이미 쓰인 유형. RLS가 학원 범위를 적용. */
export async function listUsedExamTypes(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exams')
    .select('exam_type')
    .not('exam_type', 'is', null)
  if (error) throw new Error(error.message)
  const types = (data ?? [])
    .map((r) => r.exam_type)
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
  return [...new Set(types)].sort((a, b) => a.localeCompare(b, 'ko'))
}

/**
 * 스태프 대시보드 카드 — 공개 대기(초안) 시험 수.
 * 미입력은 초안에서만 발생하므로(공개가 차단됨) 조건은 published_at IS NULL 하나로 충분하다.
 */
export async function countDraftExams(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('exams')
    .select('id', { count: 'exact', head: true })
    .is('published_at', null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * /me 대시보드 카드 — 가장 최근 "응시한"(점수 있고 미응시 아님) 공개 성적 한 줄. 없으면 null.
 * 가장 최근 공개 시험을 무조건 집으면, 그게 이 학생이 결시했거나 소급 배정 전이라 my_score가
 * 없는 시험일 때 더 예전 성적이 있어도 카드가 사라진다. ExamReportBoard.tsx와 동일한 규칙
 * (taken 필터 후 마지막)을 여기서도 써서 화면 두 곳이 어긋나지 않게 한다.
 */
export async function getLatestPublishedReportRow(
  studentId: string
): Promise<ExamReportRow | null> {
  const rows = await getExamReport(studentId)
  const taken = rows.filter((r) => r.my_score !== null && !r.my_is_absent)
  return taken.length > 0 ? taken[taken.length - 1] : null
}

/** 세션 사용자의 학원 id — 액션에서 재검증할 때 쓰기 위해 노출. */
export async function currentAcademyId(): Promise<string | null> {
  const user = await getSessionUser()
  return user?.academyId ?? null
}

/**
 * 이 시험의 "시험일 기준" 응시 대상 학생 id 목록. 없는 시험이면 빈 배열.
 * class_students는 다른 도메인(classes) 소유 테이블 — actions.ts가 명단 검증(점수 저장 시
 * 응시 대상 확인, 공개 시 미입력 판정)에 쓸 때 이 함수를 거치게 해서 (1) 도메인 경계를 지키고
 * (2) inRosterOn 판정 로직을 한 곳에서만 유지한다.
 */
export async function getExamRosterStudentIds(examId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data: exam, error: examErr } = await supabase
    .from('exams')
    .select('class_id, exam_date')
    .eq('id', examId)
    .maybeSingle()
  if (examErr) throw new Error(examErr.message)
  if (!exam) return []

  const { data, error } = await supabase
    .from('class_students')
    .select('student_id, joined_at, left_at')
    .eq('class_id', exam.class_id)
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((cs) => inRosterOn(cs, exam.exam_date))
    .map((cs) => cs.student_id)
}
