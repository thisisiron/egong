import { listStudents } from '@/lib/students/service'
import { StudentsTable } from '@/lib/students/components/StudentsTable'

export default async function StudentsPage() {
  const students = await listStudents()
  return <StudentsTable students={students} basePath="/owner" />
}
