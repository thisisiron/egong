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
  // teacher인데 담당 반이 없으면 작성 불가 — 폼 숨김
  const canCreate = allowAcademyWide || scopeOptions.length > 0
  return (
    <div className="space-y-6">
      {canCreate ? (
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <h2 className="font-semibold">새 공지 작성</h2>
          <AnnouncementCreateForm
            scopeOptions={scopeOptions}
            allowAcademyWide={allowAcademyWide}
          />
        </section>
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
