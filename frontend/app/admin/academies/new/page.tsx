import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAcademyAction } from './actions'

export default async function NewAcademyPage() {
  await requireRole(['admin'])

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">새 학원 생성</h1>
      <form action={createAcademyAction} className="space-y-4 bg-white border rounded-lg p-6">
        <div className="space-y-1">
          <Label htmlFor="name">학원명</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contract_started_at">납품 시작일</Label>
          <Input id="contract_started_at" name="contract_started_at" type="date" />
        </div>
        <hr className="my-4" />
        <p className="text-sm text-slate-600">원장 계정 발급</p>
        <div className="space-y-1">
          <Label htmlFor="owner_email">원장 이메일</Label>
          <Input id="owner_email" name="owner_email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="owner_display_name">원장 이름</Label>
          <Input id="owner_display_name" name="owner_display_name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="owner_temp_password">임시 비밀번호 (8자+)</Label>
          <Input
            id="owner_temp_password"
            name="owner_temp_password"
            type="text"
            minLength={8}
            required
          />
          <p className="text-xs text-slate-500">
            원장에게 직접 전달. 첫 로그인 후 변경하도록 안내.
          </p>
        </div>
        <Button type="submit" className="w-full">생성</Button>
      </form>
    </div>
  )
}
