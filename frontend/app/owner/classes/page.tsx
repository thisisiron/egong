import { listClasses } from '@/lib/classes/service'
import { ClassesTable } from '@/lib/classes/components/ClassesTable'

export default async function ClassesPage() {
  const classes = await listClasses()
  return <ClassesTable classes={classes ?? []} basePath="/owner" />
}
