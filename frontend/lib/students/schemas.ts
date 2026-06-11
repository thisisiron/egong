import { z } from 'zod'

const nameSchema = z
  .string()
  .trim()
  .min(1, '이름을 입력해주세요.')
  .max(50, '이름은 50자 이내로 입력해주세요.')

const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))

export const createStudentSchema = z.object({
  name: nameSchema,
  school: optionalText(50, '학교는 50자 이내로 입력해주세요.'),
  grade: optionalText(20, '학년은 20자 이내로 입력해주세요.'),
})

export const updateStudentSchema = z.object({
  id: z.string().uuid('잘못된 학생 ID 입니다.'),
  name: nameSchema,
  school: optionalText(50, '학교는 50자 이내로 입력해주세요.'),
  grade: optionalText(20, '학년은 20자 이내로 입력해주세요.'),
  status: z.enum(['enrolled', 'paused', 'graduated']),
})

export const addParentLinkSchema = z.object({
  student_id: z.string().uuid('잘못된 학생 ID 입니다.'),
  parent_email: z.string().trim().email('올바른 이메일 형식이 아닙니다.'),
  relationship: z.enum(['mother', 'father', 'other']),
})

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
export type AddParentLinkInput = z.infer<typeof addParentLinkSchema>

export const addStudentNoteSchema = z.object({
  student_id: z.string().uuid('잘못된 학생 ID 입니다.'),
  body: z
    .string()
    .trim()
    .min(1, '내용을 입력해주세요.')
    .max(2000, '메모는 2000자 이내로 입력해주세요.'),
})

export type AddStudentNoteInput = z.infer<typeof addStudentNoteSchema>

export const studentNoteIdSchema = z
  .string({ message: '잘못된 메모 ID 입니다.' })
  .uuid('잘못된 메모 ID 입니다.')
