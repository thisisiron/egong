import { z } from 'zod'

export const createClassSchema = z.object({
  name: z.string().trim().min(1, '반 이름을 입력해주세요.').max(50, '반 이름은 50자 이내로 입력해주세요.'),
  level: z.enum(['elementary', 'middle', 'high']),
  description: z.string().trim().max(200).optional().nullable().transform((v) => (v && v.length > 0 ? v : null)),
})

export type CreateClassInput = z.infer<typeof createClassSchema>
