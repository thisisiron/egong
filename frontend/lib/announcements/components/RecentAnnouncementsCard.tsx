import Link from 'next/link'

import { ymdKST } from '@/lib/date'
import type { AnnouncementWithClass } from '../types'

type Props = { items: AnnouncementWithClass[]; announcementsPath: string }

export function RecentAnnouncementsCard({ items, announcementsPath }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">최근 공지</h2>
        <Link
          href={announcementsPath}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          공지 작성 →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">아직 공지가 없습니다.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={announcementsPath}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50"
              >
                <span
                  className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-600"
                >
                  {a.class_name ?? '전체'}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{a.title}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {ymdKST(new Date(a.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
