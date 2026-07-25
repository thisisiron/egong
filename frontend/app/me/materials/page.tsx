import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { listMaterialsForStudent, signMaterialFilesByMaterial } from '@/lib/materials/service'
import { MaterialBoard } from '@/lib/materials/components/MaterialBoard'
import { ChildSelector } from '../_components/ChildSelector'

export default async function MyMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>
}) {
  const user = await getSessionUser()
  if (!user) return null
  const { child } = await searchParams

  const children = await getMyChildren()
  const studentId = child ?? children[0]?.id ?? null
  if (!studentId) {
    return <div className="text-center text-slate-500 py-12">표시할 학생 정보가 없습니다.</div>
  }

  const materials = await listMaterialsForStudent(studentId)
  const signedFiles = await signMaterialFilesByMaterial(materials)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">자료</h1>
        {user.role === 'parent' && (
          <ChildSelector items={children} current={studentId} basePath="/me/materials" />
        )}
      </header>
      <MaterialBoard
        materials={materials}
        signedFiles={signedFiles}
        academyId={user.academyId ?? ''}
        scopeOptions={[]}
        canManage={false}
      />
    </div>
  )
}
