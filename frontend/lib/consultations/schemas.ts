import { z } from 'zod'

import { ymdKST } from '@/lib/date'

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const consultationIdSchema = z
  .string({ message: '잘못된 상담 ID 입니다.' })
  .uuid('잘못된 상담 ID 입니다.')

/** KST 기준 내일 'YYYY-MM-DD'. 당일 신청은 받지 않는다(학원이 대응할 시간이 필요). */
function tomorrowKST(): string {
  return ymdKST(new Date(Date.now() + 24 * 3600_000))
}

export const requestConsultationSchema = z.object({
  student_id: z.string().uuid('자녀를 선택해주세요.'),
  preferred_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '희망 날짜를 선택해주세요.')
    .refine((d) => d >= tomorrowKST(), '내일 이후 날짜를 선택해주세요.'),
  preferred_slot: z.enum(['morning', 'afternoon', 'evening'], {
    message: '희망 시간대를 선택해주세요.',
  }),
  reason: z
    .string()
    .trim()
    .min(1, '상담 사유를 입력해주세요.')
    .max(500, '상담 사유는 500자 이내로 입력해주세요.'),
})

export const confirmConsultationSchema = z.object({
  id: consultationIdSchema,
  // datetime-local이 주는 'YYYY-MM-DDTHH:mm' — KST 벽시계로 해석한다.
  scheduled_at_local: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '상담 시각을 입력해주세요.'),
  note: z.preprocess(
    emptyToNull,
    z.string().trim().max(500, '안내 메모는 500자 이내로 입력해주세요.').nullable()
  ),
})

export const rejectConsultationSchema = z.object({
  id: consultationIdSchema,
  note: z
    .string()
    .trim()
    .min(1, '반려 사유를 입력해주세요.')
    .max(500, '반려 사유는 500자 이내로 입력해주세요.'),
})

export const cancelConsultationSchema = z.object({
  id: consultationIdSchema,
  note: z.preprocess(
    emptyToNull,
    z.string().trim().max(500, '취소 사유는 500자 이내로 입력해주세요.').nullable()
  ),
})

export type RequestConsultationInput = z.infer<typeof requestConsultationSchema>
export type ConfirmConsultationInput = z.infer<typeof confirmConsultationSchema>
export type RejectConsultationInput = z.infer<typeof rejectConsultationSchema>
export type CancelConsultationInput = z.infer<typeof cancelConsultationSchema>
