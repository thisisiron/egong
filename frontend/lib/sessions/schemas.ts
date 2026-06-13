import { z } from 'zod'

const sessionTypeSchema = z.enum(['regular', 'makeup', 'special'])

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
  type: sessionTypeSchema.default('regular'),
  force: z.boolean().optional(),
})

export const sessionUpdateSchema = z.object({
  id: z.string().uuid('잘못된 세션 ID 입니다.'),
  title: titleSchema,
  scheduled_at: scheduledAtSchema,
  unit: unitSchema,
  video_url: videoUrlSchema,
  video_notes: videoNotesSchema,
  type: sessionTypeSchema,
  force: z.boolean().optional(),
})

export const sessionDeleteSchema = z.object({
  id: z.string().uuid('잘못된 세션 ID 입니다.'),
})

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>
export type SessionDeleteInput = z.infer<typeof sessionDeleteSchema>

export const bulkCreateSessionsSchema = z.object({
  class_id: z.string().uuid('잘못된 반 ID 입니다.'),
  sessions: z
    .array(
      z.object({
        scheduled_at: z
          .string()
          .refine((v) => !Number.isNaN(new Date(v).getTime()), '잘못된 시각 형식입니다.'),
        title: z.string().trim().min(1).max(100),
      })
    )
    .min(1, '생성할 세션이 없습니다.')
    .max(366, '한 번에 최대 366건까지 생성할 수 있습니다.'),
})

export type BulkCreateSessionsInput = z.infer<typeof bulkCreateSessionsSchema>

export const sessionCancelSchema = z.object({
  id: z.string().uuid('잘못된 세션 ID 입니다.'),
  cancelled: z.boolean(),
  cancel_reason: z
    .string()
    .trim()
    .max(200, '사유는 200자 이내로 입력해주세요.')
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
})
export type SessionCancelInput = z.infer<typeof sessionCancelSchema>
