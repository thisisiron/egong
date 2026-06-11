import { getSessionUser } from '@/lib/auth'
import { listAnnouncements } from '@/lib/announcements/service'
import { getMyTeachingClasses } from '@/lib/sessions/service'
import { AnnouncementBoard } from '@/lib/announcements/components/AnnouncementBoard'

export default async function TeacherAnnouncementsPage() {
  const [user, items, classes] = await Promise.all([
    getSessionUser(),
    listAnnouncements(),
    getMyTeachingClasses(),
  ])
  if (!user) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">공지사항</h1>
      <AnnouncementBoard
        items={items}
        scopeOptions={classes}
        allowAcademyWide={false}
        currentUserId={user.id}
        isOwner={false}
      />
    </div>
  )
}
