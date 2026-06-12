import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

/** 내 학원 이름 — RLS(academy_member_read)로 본인 학원 1행만 보임.
 * admin은 전체 학원이 보여 maybeSingle이 깨지므로 호출하지 말 것 (호출부에서 role 분기).
 * 실패·없음은 null (쉘 부제는 fail-soft).
 * React cache() — layout(AppShell 부제)과 page(대시보드 헤더)가 같은 요청에서
 * 각각 호출해도 쿼리는 1번 (getSessionUser와 같은 패턴, server-cache-react).
 */
export const getMyAcademyName = cache(async (): Promise<string | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('academy')
    .select('name')
    .maybeSingle()
  if (error) return null
  return data?.name ?? null
})
