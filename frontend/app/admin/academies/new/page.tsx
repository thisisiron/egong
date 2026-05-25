import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAcademyAction } from './actions'

type SearchParams = {
  error?: string
  name?: string
  owner_email?: string
  owner_display_name?: string
  contract_started_at?: string
}

export default async function NewAcademyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin'])
  const sp = await searchParams

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">새 학원 생성</h1>

      {sp.error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold mb-1">생성 실패</p>
          <p className="text-xs">{sp.error}</p>
        </div>
      )}

      <form action={createAcademyAction} className="space-y-4 bg-white border rounded-lg p-6">
        <div className="space-y-1">
          <Label htmlFor="name">학원명</Label>
          <Input id="name" name="name" required defaultValue={sp.name ?? ''} placeholder="예: 일도수학" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contract_started_at">납품 시작일</Label>
          <Input
            id="contract_started_at"
            name="contract_started_at"
            type="date"
            defaultValue={sp.contract_started_at ?? ''}
          />
        </div>

        <hr className="my-4" />
        <p className="text-sm text-slate-600">원장 계정 발급</p>

        <div className="space-y-1">
          <Label htmlFor="owner_email">원장 이메일</Label>
          <Input
            id="owner_email"
            name="owner_email"
            type="email"
            required
            defaultValue={sp.owner_email ?? ''}
            placeholder="예: owner@ildomath.kr"
          />
          <p className="text-xs text-slate-500">
            실제 수신 가능한 이메일을 권장. <code>.test</code> · <code>.example</code> ·{' '}
            <code>.invalid</code> · <code>.localhost</code>는 사용할 수 없습니다 (RFC 2606 reserved).
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="owner_display_name">원장 이름</Label>
          <Input
            id="owner_display_name"
            name="owner_display_name"
            required
            defaultValue={sp.owner_display_name ?? ''}
            placeholder="예: 김원장"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="owner_temp_password">임시 비밀번호 (8자+)</Label>
          <Input
            id="owner_temp_password"
            name="owner_temp_password"
            type="password"
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
