import { getSessionUser } from '@/lib/auth'
import { listAnnouncements } from '@/lib/announcements/service'
import { listClasses } from '@/lib/classes/service'
import { AnnouncementBoard } from '@/lib/announcements/components/AnnouncementBoard'

export default async function OwnerAnnouncementsPage() {
  const [user, items, classes] = await Promise.all([
    getSessionUser(),
    listAnnouncements(),
    listClasses(),
  ])
  if (!user) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">공지사항</h1>
      <AnnouncementBoard
        items={items}
        scopeOptions={classes.map((c) => ({ id: c.id, name: c.name }))}
        allowAcademyWide
        currentUserId={user.id}
        isOwner
      />
    </div>
  )
}
