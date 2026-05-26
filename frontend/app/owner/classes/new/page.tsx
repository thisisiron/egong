import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClassAction } from './actions'

export default function NewClassPage() {
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">새 반 생성</h1>
      <form action={createClassAction} className="space-y-4 bg-white border border-amber-100 rounded-lg p-6">
        <div className="space-y-1">
          <Label htmlFor="name">반 이름</Label>
          <Input id="name" name="name" placeholder="예: C2-GN1" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="level">레벨</Label>
          <select
            id="level"
            name="level"
            defaultValue="high"
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="elementary">초등</option>
            <option value="middle">중등</option>
            <option value="high">고등</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">설명</Label>
          <Input id="description" name="description" />
        </div>
        <Button type="submit" className="w-full">생성</Button>
      </form>
    </div>
  )
}
