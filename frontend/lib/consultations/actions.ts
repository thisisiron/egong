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
import type { ActionResult } from './types'

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

/**
 * catch에서 잡은 에러를 사용자에게 보여줄 메시지로 좁힌다(화이트리스트).
 *
 * Fix A 이전에는 Next.js가 프로덕션 빌드에서 서버 액션 예외의 message를 가려줬다 —
 * 그래서 throw만 해두면 무슨 메시지를 담든 안전했다. throw 대신 ActionResult를
 * 반환하도록 바꾼 지금은 그 방어막이 없다. RPC의 RAISE EXCEPTION · parse()의 zod
 * 메시지 · 23505 변환 메시지는 그대로 통과시켜야 하지만, RLS 위반이나 PostgREST
 * 내부 에러 같은 임의의 영어 문자열까지 그대로 나가면 안 된다.
 *
 * 판별 기준: 한글이 하나라도 포함돼 있으면 의도한 메시지로 본다. 이 도메인에서
 * 사용자에게 보여줄 목적으로 던지는 모든 메시지(RPC RAISE EXCEPTION, zod 메시지,
 * 23505 변환)는 한국어이고, Postgres/PostgREST가 내부적으로 만드는 에러는 영어이기
 * 때문이다 — 정규식 하나로 충분히 견고하고, 메시지마다 화이트리스트를 나열하며
 * 유지보수할 필요가 없다. 원본 에러는 무엇을 걸러냈든 항상 로그에 남긴다.
 */
function toUserMessage(actionName: string, e: unknown, fallback: string): string {
  console.error(`${actionName} failed`, e)
  const message = e instanceof Error ? e.message : ''
  return /[가-힣]/.test(message) ? message : fallback
}

export async function requestConsultationAction(
  input: RequestConsultationInput
): Promise<ActionResult> {
  // requireRole은 인증 실패 시 redirect()를 호출하고, 그건 NEXT_REDIRECT digest를 던지는
  // 방식으로 동작한다 — try 안에 두면 아래 catch가 그걸 삼켜 리다이렉트가 죽는다.
  await requireRole(['parent'])
  try {
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
  } catch (e) {
    return {
      ok: false,
      message: toUserMessage('requestConsultationAction', e, '요청을 처리하지 못했습니다.'),
    }
  }

  // DB 쓰기가 이미 성공한 뒤이므로 try 밖에 둔다 — revalidatePath가 던지면 성공을
  // 실패로 오인해 사용자가 재시도하고, 이미 성공한 신청 때문에 uq_consultation_pending에
  // 걸려 "이미 대기 중인 상담 신청이 있습니다."를 보게 되는 상황을 막는다.
  revalidateAll()
  return { ok: true }
}

/** datetime-local 'YYYY-MM-DDTHH:mm'을 KST 벽시계로 읽어 ISO(UTC)로. */
function kstLocalToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString()
}

export async function confirmConsultationAction(
  input: ConfirmConsultationInput
): Promise<ActionResult> {
  await requireRole(['owner', 'teacher'])
  try {
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
  } catch (e) {
    return {
      ok: false,
      message: toUserMessage('confirmConsultationAction', e, '처리하지 못했습니다.'),
    }
  }

  revalidateAll()
  revalidateCalendars()
  return { ok: true }
}

export async function rejectConsultationAction(
  input: RejectConsultationInput
): Promise<ActionResult> {
  await requireRole(['owner', 'teacher'])
  try {
    const parsed = parse(rejectConsultationSchema, input)

    const supabase = await createClient()
    const { error } = await supabase.rpc('reject_consultation', {
      p_id: parsed.id,
      p_note: parsed.note,
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    return {
      ok: false,
      message: toUserMessage('rejectConsultationAction', e, '처리하지 못했습니다.'),
    }
  }

  revalidateAll()
  return { ok: true }
}

export async function cancelConsultationAction(
  input: CancelConsultationInput
): Promise<ActionResult> {
  await requireRole(['parent', 'owner', 'teacher'])
  try {
    const parsed = parse(cancelConsultationSchema, input)

    const supabase = await createClient()
    const { error } = await supabase.rpc('cancel_consultation', {
      p_id: parsed.id,
      // confirm_consultation과 같은 이유 — p_note는 DEFAULT NULL이 있는 선택 인자.
      p_note: parsed.note ?? undefined,
    })
    if (error) throw new Error(error.message)
  } catch (e) {
    return {
      ok: false,
      message: toUserMessage('cancelConsultationAction', e, '취소하지 못했습니다.'),
    }
  }

  revalidateAll()
  revalidateCalendars()
  return { ok: true }
}
