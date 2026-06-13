'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getMyTeachingClasses } from '@/lib/sessions/service'
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  assignmentIdSchema,
  submitAssignmentSchema,
  gradeSubmissionSchema,
} from './schemas'

function revalidateAssignments() {
  revalidatePath('/teacher/assignments')
  revalidatePath('/owner/assignments')
  revalidatePath('/me/assignments')
}

/** owner면 class가 자기 학원 소속인지, teacher면 담당 반인지 재검증. 통과 시 academyId 반환. */
async function assertCanAssignToClass(classId: string): Promise<string> {
  const user = await requireRole(['owner', 'teacher'])
  if (!user.academyId) throw new Error('소속 학원 정보가 없습니다.')
  if (user.role === 'teacher') {
    const mine = await getMyTeachingClasses()
    if (!mine.some((c) => c.id === classId)) throw new Error('담당 반이 아닙니다.')
  } else {
    const supabase = await createClient()
    const { data: cls } = await supabase
      .from('classes').select('academy_id').eq('id', classId).maybeSingle()
    if (!cls || cls.academy_id !== user.academyId) throw new Error('잘못된 반입니다.')
  }
  return user.academyId
}

/** 타겟 과제 소유권 확인 — owner: 학원 일치, teacher: 본인 작성. 통과 시 row 반환. */
async function verifyAssignmentOwnership(
  id: string
): Promise<{ academy_id: string; created_by: string | null; class_id: string }> {
  const user = await requireRole(['owner', 'teacher'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assignments')
    .select('academy_id, created_by, class_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const allowed =
    !!data &&
    (user.role === 'owner' ? data.academy_id === user.academyId : data.created_by === user.id)
  if (!allowed || !data) throw new Error('권한이 없습니다.')
  return data
}

export async function createAssignmentAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  const parsed = createAssignmentSchema.parse({
    class_id: formData.get('class_id'),
    title: formData.get('title'),
    description: formData.get('description'),
    due_at: formData.get('due_at'),
    notify_roles: formData.getAll('notify_roles'),
  })
  const academyId = await assertCanAssignToClass(parsed.class_id)

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('assignments')
    .insert({
      academy_id: academyId,
      class_id: parsed.class_id,
      title: parsed.title,
      description: parsed.description,
      due_at: parsed.due_at,
      created_by: user.id,
      author_name: user.displayName,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  if (parsed.notify_roles.length > 0) {
    try {
      await supabase.rpc('create_assignment_notifications', {
        p_assignment_id: inserted.id,
        p_roles: parsed.notify_roles,
      })
    } catch (e) {
      console.error('과제 알림 발송 실패:', e)
    }
  }
  revalidateAssignments()
}

export async function updateAssignmentAction(formData: FormData) {
  const parsed = updateAssignmentSchema.parse({
    id: formData.get('id'),
    title: formData.get('title'),
    description: formData.get('description'),
    due_at: formData.get('due_at'),
  })
  await verifyAssignmentOwnership(parsed.id)
  const supabase = await createClient()
  const { error } = await supabase
    .from('assignments')
    .update({ title: parsed.title, description: parsed.description, due_at: parsed.due_at })
    .eq('id', parsed.id)
  if (error) throw new Error(error.message)
  revalidateAssignments()
}

export async function deleteAssignmentAction(formData: FormData) {
  const id = assignmentIdSchema.parse(formData.get('id'))
  await verifyAssignmentOwnership(id)
  const supabase = await createClient()
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidateAssignments()
}

/** 학생 제출/재제출 — upsert. 재제출 시 피드백 초기화 + 선생 알림. */
export async function submitAssignmentAction(formData: FormData) {
  const user = await requireRole(['student'])
  const parsed = submitAssignmentSchema.parse({
    assignment_id: formData.get('assignment_id'),
    memo: formData.get('memo'),
    file_paths: formData.getAll('file_paths'),
  })
  const supabase = await createClient()

  const { data: stu } = await supabase
    .from('students').select('id, academy_id').eq('user_id', user.id).maybeSingle()
  if (!stu) throw new Error('학생 정보를 찾을 수 없습니다.')
  const { data: asg } = await supabase
    .from('assignments').select('class_id, academy_id').eq('id', parsed.assignment_id).maybeSingle()
  if (!asg) throw new Error('과제를 찾을 수 없습니다.')

  const { data: saved, error } = await supabase
    .from('assignment_submissions')
    .upsert(
      {
        assignment_id: parsed.assignment_id,
        student_id: stu.id,
        academy_id: stu.academy_id,
        class_id: asg.class_id,
        memo: parsed.memo,
        file_paths: parsed.file_paths,
        submitted_at: new Date().toISOString(),
        score: null,
        feedback: null,
        feedback_by: null,
        feedback_by_name: null,
        feedback_at: null,
      },
      { onConflict: 'assignment_id,student_id' }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  try {
    await supabase.rpc('notify_assignment_submitted', { p_submission_id: saved.id })
  } catch (e) {
    console.error('제출 알림 발송 실패:', e)
  }
  revalidatePath(`/me/assignments/${parsed.assignment_id}`)
  revalidatePath(`/teacher/assignments/${parsed.assignment_id}`)
}

/** 선생/원장 피드백 — comment 필수 + score 선택. RLS가 권한 강제. */
export async function gradeSubmissionAction(formData: FormData) {
  const user = await requireRole(['owner', 'teacher'])
  const parsed = gradeSubmissionSchema.parse({
    submission_id: formData.get('submission_id'),
    feedback: formData.get('feedback'),
    score: formData.get('score'),
  })
  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('assignment_submissions')
    .update({
      feedback: parsed.feedback,
      score: parsed.score,
      feedback_by: user.id,
      feedback_by_name: user.displayName,
      feedback_at: new Date().toISOString(),
    })
    .eq('id', parsed.submission_id)
    .select('assignment_id')
    .single()
  if (error) throw new Error(error.message)

  try {
    await supabase.rpc('notify_assignment_feedback', { p_submission_id: parsed.submission_id })
  } catch (e) {
    console.error('피드백 알림 발송 실패:', e)
  }
  revalidatePath(`/teacher/assignments/${updated.assignment_id}`)
  revalidatePath(`/me/assignments/${updated.assignment_id}`)
}
