import { z } from 'zod'

export const notifyRoleSchema = z.enum(['student', 'parent', 'teacher', 'owner'])

/** 공지 폼에서 넘어온 알림 대상 역할 배열 (빈 배열 허용 — 알림 없이 게시 가능). */
export const notifyRolesSchema = z.array(notifyRoleSchema)

export const notificationIdSchema = z
  .string({ message: '잘못된 알림 ID 입니다.' })
  .uuid('잘못된 알림 ID 입니다.')
