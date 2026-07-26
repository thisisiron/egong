import { z } from 'zod'

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const examIdSchema = z
  .string({ message: '잘못된 시험 ID 입니다.' })
  .uuid('잘못된 시험 ID 입니다.')

export const createExamSchema = z.object({
  class_id: z.string().uuid('반을 선택해주세요.'),
  title: z
    .string()
    .trim()
    .min(1, '시험 이름을 입력해주세요.')
    .max(200, '시험 이름은 200자 이내로 입력해주세요.'),
  exam_type: z.preprocess(
    emptyToNull,
    z.string().trim().max(50, '유형은 50자 이내로 입력해주세요.').nullable()
  ),
  scope: z.preprocess(
    emptyToNull,
    z.string().trim().max(500, '시험 범위는 500자 이내로 입력해주세요.').nullable()
  ),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시험일을 선택해주세요.'),
  max_score: z.coerce
    .number({ message: '만점을 숫자로 입력해주세요.' })
    .positive('만점은 0보다 커야 합니다.')
    .max(1000, '만점은 1000점 이내로 입력해주세요.'),
})

export const updateExamSchema = createExamSchema
  .omit({ class_id: true })
  .extend({ id: examIdSchema })

/** 한 학생의 점수 한 줄. 미응시와 점수는 동시에 존재할 수 없다(DB CHECK와 같은 규칙). */
export const scoreRowSchema = z
  .object({
    student_id: z.string().uuid('잘못된 학생 ID 입니다.'),
    score: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
      z.coerce.number().min(0, '점수는 0점 이상이어야 합니다.').nullable()
    ),
    is_absent: z.boolean(),
    memo: z.preprocess(emptyToNull, z.string().trim().max(500, '메모는 500자 이내').nullable()),
  })
  .refine((r) => !(r.is_absent && r.score !== null), {
    message: '미응시로 표시한 학생에게는 점수를 넣을 수 없습니다.',
  })

export const saveScoresSchema = z.object({
  exam_id: examIdSchema,
  rows: z.array(scoreRowSchema).max(200, '한 번에 200명까지 저장할 수 있습니다.'),
})
