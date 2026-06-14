import { z } from 'zod'

export const createQuestionSchema = z.object({
  class_id: z.string().uuid('반을 선택해주세요.'),
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내로 입력해주세요.'),
  body: z.string().trim().min(1, '질문 내용을 입력해주세요.').max(5000, '내용은 5000자 이내로 입력해주세요.'),
  is_public: z.coerce.boolean(),
  file_paths: z.array(z.string().min(1)).max(20, '파일은 최대 20개'),
})

export const questionIdSchema = z.string().uuid('잘못된 질문 ID 입니다.')

export const toggleResolvedSchema = z.object({
  id: z.string().uuid('잘못된 질문 ID 입니다.'),
  is_resolved: z.coerce.boolean(),
})

export const createReplySchema = z.object({
  question_id: z.string().uuid(),
  body: z.string().trim().min(1, '답글 내용을 입력해주세요.').max(5000, '내용은 5000자 이내로 입력해주세요.'),
  file_paths: z.array(z.string().min(1)).max(20, '파일은 최대 20개'),
})
