import 'server-only'

import { ymdKST } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import type { Consultation, ConsultationStatus } from './types'

// 이름은 스냅샷 컬럼이라 조인이 없다 — teacher가 students/parents를 못 읽어도
// 학원 전체 목록이 온전히 채워진다.
const COLUMNS =
  'id, academy_id, student_id, parent_id, status, preferred_date, preferred_slot, ' +
  'reason, student_name, parent_name, scheduled_at, handler_name, response_note, ' +
  'responded_at, created_at'

/** 자녀 한 명의 상담 목록 (최신순). RLS가 본인 신청분만 반환. */
export async function listMyConsultations(studentId: string): Promise<Consultation[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consultations')
    .select(COLUMNS)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Consultation[]
}

/** 학원 상담 목록. RLS가 owner·teacher의 학원 범위로 제한. */
export async function listAcademyConsultations(
  status?: ConsultationStatus
): Promise<Consultation[]> {
  const supabase = await createClient()
  let query = supabase
    .from('consultations')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Consultation[]
}

/**
 * 기간 내 확정 상담을 캘린더 마커 모양으로.
 * buildMonthDays(...)의 events 파라미터가 `{ type, event_date }`만 읽으므로
 * 같은 모양으로 맞춰 기존 배열에 concat하면 된다 — 빌더는 손대지 않는다.
 * fromDate/toDate는 'YYYY-MM-DD'(KST). scheduled_at은 timestamptz라 KST 하루 경계로
 * 변환해 비교한다 (UTC+9 고정, DST 없음).
 */
export async function getConfirmedConsultationsInRange(
  fromDate: string,
  toDate: string
): Promise<Array<{ type: 'consultation'; event_date: string }>> {
  const supabase = await createClient()
  const fromIso = new Date(`${fromDate}T00:00:00+09:00`).toISOString()
  // toDate 당일을 포함하려면 다음 날 00:00 KST 직전까지 — 반개구간 [from, to)
  const toIso = new Date(
    new Date(`${toDate}T00:00:00+09:00`).getTime() + 24 * 3600_000
  ).toISOString()

  const { data, error } = await supabase
    .from('consultations')
    .select('scheduled_at')
    .eq('status', 'confirmed')
    .gte('scheduled_at', fromIso)
    .lt('scheduled_at', toIso)
  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter((r): r is { scheduled_at: string } => r.scheduled_at !== null)
    .map((r) => ({
      type: 'consultation' as const,
      // KST 벽시계 날짜로 버킷팅
      event_date: ymdKST(new Date(r.scheduled_at)),
    }))
}
