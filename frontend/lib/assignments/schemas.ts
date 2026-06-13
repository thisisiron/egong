import { z } from 'zod'

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const createAssignmentSchema = z.object({
  class_id: z.string().uuid('반을 선택해주세요.'),
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내로 입력해주세요.'),
  description: z.preprocess(emptyToNull, z.string().trim().max(5000, '설명은 5000자 이내').nullable()),
  due_at: z.preprocess(emptyToNull, z.string().datetime({ offset: true }).nullable()),
  notify_roles: z.array(z.enum(['student', 'parent'])),
})

export const updateAssignmentSchema = z.object({
  id: z.string().uuid('잘못된 과제 ID 입니다.'),
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200),
  description: z.preprocess(emptyToNull, z.string().trim().max(5000).nullable()),
  due_at: z.preprocess(emptyToNull, z.string().datetime({ offset: true }).nullable()),
})

export const assignmentIdSchema = z.string().uuid('잘못된 과제 ID 입니다.')
export const submissionIdSchema = z.string().uuid('잘못된 제출 ID 입니다.')

export const submitAssignmentSchema = z.object({
  assignment_id: z.string().uuid(),
  memo: z.preprocess(emptyToNull, z.string().trim().max(2000, '메모는 2000자 이내').nullable()),
  file_paths: z.array(z.string().min(1)).max(20, '파일은 최대 20개'),
})

export const gradeSubmissionSchema = z.object({
  submission_id: z.string().uuid(),
  feedback: z.string().trim().min(1, '피드백 코멘트를 입력해주세요.').max(2000),
  score: z.preprocess(emptyToNull, z.string().trim().max(50).nullable()),
})
