import { z } from 'zod'

const eventTypeSchema = z.enum(['exam', 'consultation'])

const titleSchema = z
  .string()
  .trim()
  .min(1, '제목을 입력해주세요.')
  .max(100, '제목은 100자 이내로 입력해주세요.')

const eventDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.')

const memoSchema = z
  .string()
  .trim()
  .max(500, '메모는 500자 이내로 입력해주세요.')
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))

// class_id: 빈 문자열 = 학원 전체(NULL), 값 있으면 uuid
const classIdSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))
  .refine(
    (v) => v === null || /^[0-9a-f-]{36}$/i.test(v),
    '잘못된 반 ID 입니다.'
  )

export const createEventSchema = z.object({
  type: eventTypeSchema,
  title: titleSchema,
  event_date: eventDateSchema,
  class_id: classIdSchema,
  memo: memoSchema,
})

export const updateEventSchema = z.object({
  id: z.string().uuid('잘못된 이벤트 ID 입니다.'),
  type: eventTypeSchema,
  title: titleSchema,
  event_date: eventDateSchema,
  class_id: classIdSchema,
  memo: memoSchema,
})

export const eventIdSchema = z.string().uuid('잘못된 이벤트 ID 입니다.')

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
