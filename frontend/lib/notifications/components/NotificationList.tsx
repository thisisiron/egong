'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import type { Notification } from '../types'
import { markNotificationReadAction } from '../actions'
import { kstParts } from '@/lib/date'

type Props = {
  items: Notification[]
  /** 항목 클릭 시(드롭다운 닫기 등) */
  onNavigate?: () => void
  /** 읽지 않은 항목 클릭 시 뱃지 감소 */
  onItemRead?: () => void
}

/** 상대 시각 — "방금 전 / N분 전 / N시간 전 / M월 D일".
 * Date.now() 기준이지만 하이드레이션 mismatch 우려는 없다 — 이 컴포넌트는
 * NotificationBell.tsx의 `{open && <NotificationList .../>}`로만 렌더되어 SSR에도
 * 최초 하이드레이션 렌더에도 존재하지 않는다(벨을 클릭해 open이 true가 된 후에야
 * 마운트됨). 즉 서버 스냅샷과 비교할 대상 자체가 없다.
 *
 * fallback(1일 이상 지난 항목)의 월/일은 kstParts로 KST 기준 고정 —
 * new Date().getMonth()/getDate()는 실행 환경의 로컬 타임존을 따라 KST가 아닌
 * 기기에서 날짜가 하루 어긋날 수 있다(이 저장소의 KST 고정 규칙, lib/date.ts 참고).
 * 이전 커밋(fb6ee60)은 이 fallback을 formatDateTimeKR + `mounted` 가드로 감쌌으나,
 * 위 이유로 mounted는 항상 true라 그 분기는 죽은 코드였다 — kstParts 수정만 남기고
 * useMounted/useSyncExternalStore는 제거했다.
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
            <span className="text-xs text-slate-400">{relTime(n.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
