'use server'

import { revalidatePath } from 'next/cache'
import { ZodError, type ZodType } from 'zod'

import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

import {
  cancelConsultationSchema,
  confirmConsultationSchema,
  rejectConsultationSchema,
  requestConsultationSchema,
  type CancelConsultationInput,
  type ConfirmConsultationInput,
  type RejectConsultationInput,
  type RequestConsultationInput,
} from './schemas'

/**
 * exams/actions.ts의 parse()와 같은 이유 — ZodError.message는 이슈 배열을 JSON으로
 * 직렬화한 문자열이라 그대로 화면에 띄우면 사용자에게 JSON 블롭이 보인다.
 */
function parse<Schema extends ZodType>(schema: Schema, data: unknown): Schema['_output'] {
  try {
    return schema.parse(data)
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(e.issues[0]?.message ?? '입력값이 올바르지 않습니다.')
    }
    throw e
  }
}

function revalidateAll() {
  revalidatePath('/me/consultations')
  revalidatePath('/teacher/consultations')
  revalidatePath('/owner/consultations')
}

function revalidateCalendars() {
  revalidatePath('/me')
  revalidatePath('/teacher/schedule')
  revalidatePath('/owner/schedule')
}

export async function requestConsultationAction(input: RequestConsultationInput) {
  await requireRole(['parent'])
  const parsed = parse(requestConsultationSchema, input)

  const supabase = await createClient()
  // RPC 하나가 자녀 검증 · academy_id/parent_id 해석 · 이름 스냅샷 · INSERT ·
  // 스태프 알림을 한 트랜잭션으로 처리한다. 신청만 남고 알림이 유실될 여지가 없다.
  const { error } = await supabase.rpc('request_consultation', {
    p_student_id: parsed.student_id,
    p_preferred_date: parsed.preferred_date,
    p_preferred_slot: parsed.preferred_slot,
    p_reason: parsed.reason,
  })
  if (error) {
    // uq_consultation_pending 위반을 사용자 언어로 바꾼다.
    if (error.code === '23505') {
      throw new Error('이미 대기 중인 상담 신청이 있습니다.')
    }
    throw new Error(error.message)
  }

  revalidateAll()
}

/** datetime-local 'YYYY-MM-DDTHH:mm'을 KST 벽시계로 읽어 ISO(UTC)로. */
function kstLocalToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString()
}

export async function confirmConsultationAction(input: ConfirmConsultationInput) {
  await requireRole(['owner', 'teacher'])
  const parsed = parse(confirmConsultationSchema, input)

  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_consultation', {
    p_id: parsed.id,
    p_scheduled_at: kstLocalToIso(parsed.scheduled_at_local),
    // p_note는 DEFAULT NULL이 있는 선택 인자 — 생성된 타입은 `p_note?: string`(| null
    // 없음)이라 undefined로 넘겨야 db:types 재생성 후에도 tsc가 통과한다. supabase-js가
    // undefined 키를 본문에서 빼면 PostgREST가 SQL의 DEFAULT NULL을 적용한다.
    p_note: parsed.note ?? undefined,
  })
  if (error) throw new Error(error.message)

  revalidateAll()
  revalidateCalendars()
}

export async function rejectConsultationAction(input: RejectConsultationInput) {
  await requireRole(['owner', 'teacher'])
  const parsed = parse(rejectConsultationSchema, input)

  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_consultation', {
    p_id: parsed.id,
    p_note: parsed.note,
  })
  if (error) throw new Error(error.message)

  revalidateAll()
}

export async function cancelConsultationAction(input: CancelConsultationInput) {
  await requireRole(['parent', 'owner', 'teacher'])
  const parsed = parse(cancelConsultationSchema, input)

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_consultation', {
    p_id: parsed.id,
    // confirm_consultation과 같은 이유 — p_note는 DEFAULT NULL이 있는 선택 인자.
    p_note: parsed.note ?? undefined,
  })
  if (error) throw new Error(error.message)

  revalidateAll()
  revalidateCalendars()
}
