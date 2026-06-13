import { listParents } from '@/lib/parents/service'
import { ParentsTable } from '@/lib/parents/components/ParentsTable'

export default async function TeacherParentsPage() {
  const parents = await listParents()
  return <ParentsTable parents={parents} basePath="/teacher" />
}
