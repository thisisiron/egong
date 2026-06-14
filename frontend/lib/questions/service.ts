import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { Question, QuestionWithClass, QuestionReply } from './types'

const Q_COLS =
  'id, academy_id, class_id, student_id, author_name, title, body, file_paths, is_public, is_resolved, created_at'
const R_COLS = 'id, question_id, academy_id, author_id, author_role, author_name, body, file_paths, created_at'

type JoinedQuestion = Question & { classes: { name: string } | { name: string }[] | null }
function withClassName(row: JoinedQuestion): QuestionWithClass {
  const { classes, ...q } = row
  const cls = Array.isArray(classes) ? classes[0] : classes
  return { ...q, class_name: cls?.name ?? null }
}

/** 선생/원장 — 권한 범위 질문 목록 (RLS 적용). 최신순. */
export async function listQuestionsForStaff(): Promise<QuestionWithClass[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select(`${Q_COLS}, classes(name)`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

/** 학생/학부모 — 해당 학생이 속한 반의 질문(RLS가 내 질문 + 공개 질문만 노출). 최신순. */
export async function listQuestionsForStudent(studentId: string): Promise<QuestionWithClass[]> {
  const supabase = await createClient()
  const { data: cs, error: csErr } = await supabase
    .from('class_students').select('class_id').eq('student_id', studentId).is('left_at', null)
  if (csErr) throw new Error(csErr.message)
  const classIds = (cs ?? []).map((r) => r.class_id)
  if (classIds.length === 0) return []
  const { data, error } = await supabase
    .from('questions')
    .select(`${Q_COLS}, classes(name)`)
    .in('class_id', classIds)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(withClassName)
}

export async function getQuestion(id: string): Promise<QuestionWithClass | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions').select(`${Q_COLS}, classes(name)`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? withClassName(data as JoinedQuestion) : null
}

/** 한 질문의 답글 스레드 (오래된 순 = 대화 흐름). RLS가 가시성 강제. */
export async function listReplies(questionId: string): Promise<QuestionReply[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('question_replies')
    .select(R_COLS)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as QuestionReply[]
}

/** 첨부 path[] → signed URL[] (비공개 버킷 열람). RLS SELECT 통과 필요. */
export async function signQuestionFiles(
  paths: string[]
): Promise<Array<{ path: string; url: string | null }>> {
  if (paths.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from('question-files').createSignedUrls(paths, 60 * 10)
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({ path: d.path ?? '', url: d.signedUrl ?? null }))
}

/** 학생 — 내가 현재 속한 반 목록(질문 작성 폼 드롭다운용). */
export async function getMyEnrolledClasses(studentId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('class_students')
    .select('classes(id, name)')
    .eq('student_id', studentId)
    .is('left_at', null)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((r: { classes: { id: string; name: string } | { id: string; name: string }[] | null }) => {
      const c = Array.isArray(r.classes) ? r.classes[0] : r.classes
      return c ?? null
    })
    .filter((c): c is { id: string; name: string } => !!c)
}
