import { getSessionUser } from '@/lib/auth'
import { getMyChildren, getStudentProfile } from '@/lib/students/service'
import { listBoardAnnouncements } from '@/lib/announcements/service'
import { AnnouncementCard } from '@/lib/announcements/components/AnnouncementCard'
import { ChildSelector } from '../_components/ChildSelector'

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child: childParam } = await searchParams

  const children = await getMyChildren()
  const targetStudentId = childParam ?? children[0]?.id ?? null

  if (!targetStudentId) {
    return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>
  }

  const [student, announcements] = await Promise.all([
    getStudentProfile(targetStudentId),
    listBoardAnnouncements(targetStudentId),
  ])

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">게시판</h1>
        {user.role === 'parent' && (
          <ChildSelector items={children} current={targetStudentId} basePath="/me/board" />
        )}
      </header>
      <p className="text-sm text-slate-500">{student?.name} · 학원 공지와 우리 반 공지</p>

      <div className="space-y-2">
        {announcements.map((a) => (
          <AnnouncementCard key={a.id} announcement={a} canManage={false} />
        ))}
        {announcements.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">공지사항이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
