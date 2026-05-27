import { z } from 'zod'

export const applicationSubmitSchema = z.object({
  applicant_name: z.string().min(1, '이름을 입력하세요').max(100),
  applicant_email: z.string().email('올바른 이메일 형식이 아닙니다'),
  applicant_phone: z
    .string()
    .min(10, '연락처를 입력하세요')
    .max(20)
    .regex(/^[\d\-]+$/, '숫자와 - 만 입력 가능'),

  academy_name: z.string().min(1, '학원명을 입력하세요').max(200),
  academy_region: z.string().max(200).nullable().optional(),
  academy_student_count: z
    .enum(['under_50', '50_to_200', 'over_200'])
    .nullable()
    .optional(),
  inquiry_message: z.string().max(2000).nullable().optional(),

  business_type: z.enum(['individual', 'corporate', 'tutoring', 'planned'], {
    message: '사업자 유형을 선택하세요',
  }),
  business_name: z.string().min(1, '사업자/상호명을 입력하세요').max(200),
  business_owner_name: z.string().min(1, '대표자명을 입력하세요').max(100),
  business_number: z.string().max(20).nullable().optional(),
  registration_file_path: z.string().max(500).nullable().optional(),
  verified_b_stt_cd: z
    .union([z.literal('01'), z.literal('02'), z.null()])
    .optional()
    .nullable(),
})

export type ApplicationSubmitSchema = z.infer<typeof applicationSubmitSchema>
