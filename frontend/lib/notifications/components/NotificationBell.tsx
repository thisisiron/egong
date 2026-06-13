'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import type { Notification } from '../types'
import { markAllReadAction } from '../actions'
import { NotificationList } from './NotificationList'

type Props = {
  initialItems: Notification[]
  initialUnread: number
}

export function NotificationBell({ initialItems, initialUnread }: Props) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnread)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function handleMarkAll() {
    setUnread(0)
    startTransition(() => markAllReadAction())
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        aria-expanded={open}
        className="relative rounded-md p-1.5 text-slate-500 hover:bg-gray-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-medium text-slate-700">알림</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs text-indigo-600 hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>
          <NotificationList items={initialItems} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
