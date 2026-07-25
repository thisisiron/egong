import { requireRole } from '@/lib/auth'
import { listClasses } from '@/lib/classes/service'
import { listMaterials, signMaterialFilesByMaterial } from '@/lib/materials/service'
import { MaterialBoard } from '@/lib/materials/components/MaterialBoard'

export default async function TeacherMaterialsPage() {
  const user = await requireRole(['teacher'])
  const [materials, classes] = await Promise.all([listMaterials(), listClasses()])
  const signedFiles = await signMaterialFilesByMaterial(materials)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">자료</h1>
      <MaterialBoard
        materials={materials}
        signedFiles={signedFiles}
        academyId={user.academyId ?? ''}
        scopeOptions={classes.map((c) => ({ id: c.id, name: c.name }))}
        canManage
      />
    </div>
  )
}
