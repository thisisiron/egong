'use client'

import Link from 'next/link'
import { useSyncExternalStore, useTransition } from 'react'
import type { Notification } from '../types'
import { markNotificationReadAction } from '../actions'
import { formatDateTimeKR } from '@/lib/format'
import { kstParts } from '@/lib/date'

const emptySubscribe = () => () => {}

/** 서버 렌더에서는 항상 false, 클라이언트 하이드레이션이 끝난 뒤에는 true.
 * `useState(false)` + `useEffect(() => setMounted(true), [])` 조합도 같은 목적을
 * 이루지만 effect 안에서 곧바로 setState를 부르는 패턴이라 react-hooks/
 * set-state-in-effect 린트가 막는다(캐스케이딩 렌더 경고). 구독할 외부 스토어가
 * 없는 useSyncExternalStore로 같은 "서버/클라이언트 다른 값"을 표현한다 —
 * subscribe는 no-op이고 서버 스냅샷(false)과 클라이언트 스냅샷(true)만 다르게 준다.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

type Props = {
  items: Notification[]
  /** 항목 클릭 시(드롭다운 닫기 등) */
  onNavigate?: () => void
  /** 읽지 않은 항목 클릭 시 뱃지 감소 */
  onItemRead?: () => void
}

/** 상대 시각 — "방금 전 / N분 전 / N시간 전 / M월 D일".
 * Date.now() 기준이라 서버 렌더 시각과 클라이언트 렌더 시각이 다르면 값이 갈릴 수
 * 있다(예: "3분 전" vs "4분 전") — 그래서 마운트 후(NotificationList의 `mounted`)에만
 * 호출한다. 이 알림 벨은 AppShell에 있어 전 페이지에서 렌더되므로 영향 범위가 넓다.
 *
 * fallback(1일 이상 지난 항목)의 월/일은 kstParts로 KST 기준 고정 —
 * new Date().getMonth()/getDate()는 실행 환경의 로컬 타임존을 따라 KST가 아닌
 * 기기에서 날짜가 하루 어긋날 수 있다(이 저장소의 KST 고정 규칙, lib/date.ts 참고).
 */
function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMin = Math.floor((Date.now() - then) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`
  const { month, day } = kstParts(new Date(iso))
  return `${month}월 ${day}일`
}

export function NotificationList({ items, onNavigate, onItemRead }: Props) {
  const [, startTransition] = useTransition()
  // 서버/최초 클라이언트 렌더에서는 relTime(Date.now() 기준) 대신 로케일·ICU
  // 무관한 절대 표기(formatDateTimeKR)를 쓰고, 마운트 후에만 상대 시간으로 바꿔
  // 하이드레이션 mismatch를 원천 차단한다. 드롭다운 안이라 첫 페인트 깜빡임의
  // 사용자 영향은 작다.
  const mounted = useMounted()

  if (items.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-400">새 알림이 없습니다.</p>
  }

  return (
    <ul className="max-h-80 overflow-y-auto">
      {items.map((n) => (
        <li key={n.id}>
          <Link
            href={n.link}
            onClick={() => {
              if (!n.read_at) {
                startTransition(() => markNotificationReadAction(n.id))
                onItemRead?.()
              }
              onNavigate?.()
            }}
            className="flex flex-col gap-0.5 border-b border-gray-100 px-4 py-3 hover:bg-gray-50"
          >
            <span className="flex items-center gap-2">
              {!n.read_at && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" aria-label="안읽음" />
              )}
              <span className="truncate text-sm text-slate-800">{n.title}</span>
            </span>
            <span className="text-xs text-slate-400">
              {mounted ? relTime(n.created_at) : formatDateTimeKR(n.created_at)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
