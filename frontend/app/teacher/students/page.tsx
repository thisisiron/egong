import { listStudents } from '@/lib/students/service'
import { StudentsTable } from '@/lib/students/components/StudentsTable'

export default async function TeacherStudentsPage() {
  const students = await listStudents()
  return <StudentsTable students={students} basePath="/teacher" />
}
