import { apiFetch } from '@/lib/api/client'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateAcademyAction } from './actions'

type Academy = {
  id: string
  name: string
  status: string
  contract_started_at: string | null
  created_at: string
}

export default async function AcademyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole(['admin'])
  const { id } = await params
  const a = await apiFetch<Academy>(`/admin/academies/${id}`)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">{a.name}</h1>
      <form action={updateAcademyAction} className="space-y-4 bg-white border rounded-lg p-6">
        <input type="hidden" name="id" value={a.id} />
        <div className="space-y-1">
          <Label htmlFor="name">학원명</Label>
          <Input id="name" name="name" defaultValue={a.name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">상태</Label>
          <select
            id="status"
            name="status"
            defaultValue={a.status}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="deleted">deleted</option>
          </select>
        </div>
        <Button type="submit">저장</Button>
      </form>
    </div>
  )
}
