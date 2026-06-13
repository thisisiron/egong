'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AnnouncementCard } from './AnnouncementCard'
import { AnnouncementCreateForm } from './AnnouncementCreateForm'
import type { AnnouncementWithClass, ScopeOption } from '../types'

type Props = {
  items: AnnouncementWithClass[]
  scopeOptions: ScopeOption[]
  allowAcademyWide: boolean
  currentUserId: string
  isOwner: boolean
}

export function AnnouncementBoard({
  items,
  scopeOptions,
  allowAcademyWide,
  currentUserId,
  isOwner,
}: Props) {
  // teacher인데 담당 반이 없으면 작성 불가 — 글작성 버튼 숨김
  const canCreate = allowAcademyWide || scopeOptions.length > 0
  const [composing, setComposing] = useState(false)

  // 작성 화면 — "글작성"을 눌렀을 때만 진입
  if (composing) {
    return (
      <div className="space-y-6">
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">새 공지 작성</h2>
            <Button variant="ghost" onClick={() => setComposing(false)}>
              목록으로
            </Button>
          </div>
          <AnnouncementCreateForm
            scopeOptions={scopeOptions}
            allowAcademyWide={allowAcademyWide}
            onSuccess={() => setComposing(false)}
          />
        </section>
      </div>
    )
  }

  // 기본 화면 — 게시판(목록)
  return (
    <div className="space-y-6">
      {canCreate ? (
        <div className="flex justify-end">
          <Button onClick={() => setComposing(true)}>글작성</Button>
        </div>
      ) : null}
      <section className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">아직 공지가 없습니다.</p>
        ) : null}
        {items.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            canManage={isOwner || a.created_by === currentUserId}
          />
        ))}
      </section>
    </div>
  )
}
