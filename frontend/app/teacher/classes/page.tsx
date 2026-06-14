import { listClasses } from '@/lib/classes/service'
import { ClassesTable } from '@/lib/classes/components/ClassesTable'

export default async function TeacherClassesPage() {
  const classes = await listClasses()
  return <ClassesTable classes={classes ?? []} basePath="/teacher" />
}
