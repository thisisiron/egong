import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getStudentDetail, listStudentNotes } from '@/lib/students/service'
import { StudentDetailView } from '@/lib/students/components/StudentDetailView'

export default async function TeacherStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { id } = await params
  const { month: monthParam } = await searchParams
  const view = await getStudentDetail(id)
  if (!view) notFound()

  const [notes, user] = await Promise.all([
    listStudentNotes(id),
    getSessionUser(),
  ])
  if (!user) notFound()

  return (
    <StudentDetailView
      view={view}
      notes={notes}
      user={user}
      monthParam={monthParam}
    />
  )
}
