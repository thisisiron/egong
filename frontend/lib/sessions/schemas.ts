import { z } from 'zod'

const titleSchema = z
  .string()
  .trim()
  .min(1, '수업 제목을 입력해주세요.')
  .max(100, '제목은 100자 이내로 입력해주세요.')

const unitSchema = z
  .string()
  .trim()
  .max(50, '단원은 50자 이내로 입력해주세요.')
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))

// datetime-local 입력 '2026-05-31T14:00' 또는 ISO '2026-05-31T14:00:00+00:00' 둘 다 허용
const scheduledAtSchema = z
  .string()
  .min(1, '수업 시각을 선택해주세요.')
  .refine((v) => !Number.isNaN(new Date(v).getTime()), '잘못된 시각 형식입니다.')

const videoUrlSchema = z
  .string()
  .trim()
  .url('올바른 URL 형식이 아닙니다.')
  .or(z.literal(''))
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))

const videoNotesSchema = z
  .string()
  .trim()
  .max(500, '영상 메모는 500자 이내로 입력해주세요.')
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))

export const sessionCreateSchema = z.object({
  class_id: z.string().uuid('잘못된 반 ID 입니다.'),
  title: titleSchema,
  scheduled_at: scheduledAtSchema,
  unit: unitSchema,
})

export const sessionUpdateSchema = z.object({
  id: z.string().uuid('잘못된 세션 ID 입니다.'),
  title: titleSchema,
  scheduled_at: scheduledAtSchema,
  unit: unitSchema,
  video_url: videoUrlSchema,
  video_notes: videoNotesSchema,
})

export const sessionDeleteSchema = z.object({
  id: z.string().uuid('잘못된 세션 ID 입니다.'),
})

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>
export type SessionDeleteInput = z.infer<typeof sessionDeleteSchema>
