import { z } from 'zod'

const titleSchema = z
  .string()
  .trim()
  .min(1, '제목을 입력해주세요.')
  .max(200, '제목은 200자 이내로 입력해주세요.')

const bodySchema = z
  .string()
  .trim()
  .min(1, '내용을 입력해주세요.')
  .max(5000, '내용은 5000자 이내로 입력해주세요.')

/** select의 '' (학원 전체) → null 변환. */
const classIdSchema = z
  .string()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().uuid('잘못된 반 ID 입니다.').nullable())

export const createAnnouncementSchema = z.object({
  title: titleSchema,
  body: bodySchema,
  class_id: classIdSchema,
})

// 수정은 제목/본문만 — 범위(class_id) 변경은 미지원 (삭제 후 재작성)
export const updateAnnouncementSchema = z.object({
  id: z.string().uuid('잘못된 공지 ID 입니다.'),
  title: titleSchema,
  body: bodySchema,
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>
