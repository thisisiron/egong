import { listTeachers } from '@/lib/teachers/service'
import { TeachersTable } from '@/lib/teachers/components/TeachersTable'

export default async function TeachersPage() {
  const teachers = await listTeachers()
  return <TeachersTable teachers={teachers} basePath="/owner" />
}
