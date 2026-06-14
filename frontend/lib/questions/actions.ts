'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ReplyAuthorRole } from './types'
import {
  createQuestionSchema,
  questionIdSchema,
  toggleResolvedSchema,
  createReplySchema,
} from './schemas'

function revalidateQuestions() {
  revalidatePath('/me/questions')
  revalidatePath('/teacher/questions')
  revalidatePath('/owner/questions')
}

/** 학생 질문 등록 — 본인이 속한 반에만. 등록 후 담당 선생에게 알림. */
export async function createQuestionAction(formData: FormData) {
  const user = await requireRole(['student'])
  const parsed = createQuestionSchema.parse({
    class_id: formData.get('class_id'),
    title: formData.get('title'),
    body: formData.get('body'),
    is_public: formData.get('is_public') === 'on',
    file_paths: formData.getAll('file_paths'),
  })
  const supabase = await createClient()

  const { data: stu } = await supabase
    .from('students').select('id, academy_id').eq('user_id', user.id).maybeSingle()
  if (!stu) throw new Error('학생 정보를 찾을 수 없습니다.')

  // 수강 등록 재검증 (RLS 위 2차 방어선) — 내가 속한 반인지 명시 확인.
  const { data: enrolled } = await supabase
    .from('class_students')
    .select('id').eq('class_id', parsed.class_id).eq('student_id', stu.id).is('left_at', null).maybeSingle()
  if (!enrolled) throw new Error('이 반에 질문할 권한이 없습니다.')

  const { data: inserted, error } = await supabase
    .from('questions')
    .insert({
      academy_id: stu.academy_id,
      class_id: parsed.class_id,
      student_id: stu.id,
      author_name: user.displayName,
      title: parsed.title,
      body: parsed.body,
      is_public: parsed.is_public,
      file_paths: parsed.file_paths,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  try {
    await supabase.rpc('notify_question_created', { p_question_id: inserted.id })
  } catch (e) {
    console.error('질문 알림 발송 실패:', e)
  }
  revalidateQuestions()
}

/** 질문 삭제 — 작성 학생 또는 학원 스태프(RLS가 강제). */
export async function deleteQuestionAction(formData: FormData) {
  await requireRole(['student', 'teacher', 'owner'])
  const id = questionIdSchema.parse(formData.get('id'))
  const supabase = await createClient()
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateQuestions()
}

/** 해결됨 토글 — 작성 학생 또는 담당 선생/원장(RLS가 강제). */
export async function toggleResolvedAction(formData: FormData) {
  await requireRole(['student', 'teacher', 'owner'])
  const parsed = toggleResolvedSchema.parse({
    id: formData.get('id'),
    is_resolved: formData.get('is_resolved') === 'true',
  })
  const supabase = await createClient()
  const { error } = await supabase
    .from('questions').update({ is_resolved: parsed.is_resolved }).eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidatePath(`/me/questions/${parsed.id}`)
  revalidatePath(`/teacher/questions/${parsed.id}`)
  revalidatePath(`/owner/questions/${parsed.id}`)
}

/** 답글 등록 — 선생/원장 항상, 학생은 공개 질문+내 반만(RLS가 최종 강제). 등록 후 알림. */
export async function createReplyAction(formData: FormData) {
  const user = await requireRole(['student', 'teacher', 'owner'])
  const parsed = createReplySchema.parse({
    question_id: formData.get('question_id'),
    body: formData.get('body'),
    file_paths: formData.getAll('file_paths'),
  })
  const supabase = await createClient()

  // academy_id: 부모 질문에서 가져와 비정규화 일관성 유지.
  const { data: q } = await supabase
    .from('questions').select('academy_id').eq('id', parsed.question_id).maybeSingle()
  if (!q) throw new Error('질문을 찾을 수 없습니다.')

  const { data: saved, error } = await supabase
    .from('question_replies')
    .insert({
      question_id: parsed.question_id,
      academy_id: q.academy_id,
      author_id: user.id,
      author_role: user.role as ReplyAuthorRole,
      author_name: user.displayName,
      body: parsed.body,
      file_paths: parsed.file_paths,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  try {
    await supabase.rpc('notify_question_reply', { p_reply_id: saved.id })
  } catch (e) {
    console.error('답글 알림 발송 실패:', e)
  }
  revalidatePath(`/me/questions/${parsed.question_id}`)
  revalidatePath(`/teacher/questions/${parsed.question_id}`)
  revalidatePath(`/owner/questions/${parsed.question_id}`)
}
