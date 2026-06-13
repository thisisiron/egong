'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import type { Notification } from '../types'
import { markNotificationReadAction } from '../actions'

type Props = {
  items: Notification[]
  /** 항목 클릭 시(드롭다운 닫기 등) */
  onNavigate?: () => void
}

/** 상대 시각 — "방금 전 / N분 전 / N시간 전 / M월 D일". */
function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMin = Math.floor((Date.now() - then) / 60000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function NotificationList({ items, onNavigate }: Props) {
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
              if (!n.read_at) startTransition(() => markNotificationReadAction(n.id))
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
