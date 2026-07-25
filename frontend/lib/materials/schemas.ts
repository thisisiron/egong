import { z } from 'zod'
import { notifyRolesSchema } from '@/lib/notifications/schemas'

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

/** select의 '' (학원 전체) → null 변환. */
const classIdSchema = z
  .string()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().uuid('잘못된 반 ID 입니다.').nullable())

/** 업로드 결과 [{path,name}] — 폼이 JSON 문자열로 실어 보낸다. */
export const materialFilesSchema = z
  .array(z.object({ path: z.string().min(1), name: z.string().min(1) }))
  .min(1, '파일을 1개 이상 첨부해주세요.')
  .max(20, '파일은 최대 20개입니다.')

export const materialIdSchema = z
  .string({ message: '잘못된 자료 ID 입니다.' })
  .uuid('잘못된 자료 ID 입니다.')

export const createMaterialSchema = z.object({
  class_id: classIdSchema,
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내로 입력해주세요.'),
  description: z.preprocess(emptyToNull, z.string().trim().max(5000, '설명은 5000자 이내').nullable()),
  files: materialFilesSchema,
  notify_roles: notifyRolesSchema,
})

export const updateMaterialSchema = z.object({
  id: materialIdSchema,
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200),
  description: z.preprocess(emptyToNull, z.string().trim().max(5000).nullable()),
})
