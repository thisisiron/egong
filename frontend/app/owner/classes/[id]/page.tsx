import { notFound } from 'next/navigation'
import { getClassDetailView } from '@/lib/classes/service'
import { ClassDetail } from '@/lib/classes/components/ClassDetail'

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await getClassDetailView(id)
  if (!view) notFound()
  return <ClassDetail view={view} basePath="/owner" />
}
