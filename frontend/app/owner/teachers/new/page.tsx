import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTeacherAction } from '@/lib/teachers/actions'

export default function NewTeacherPage() {
  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">선생님 등록</h1>
      <form action={createTeacherAction} className="space-y-4 bg-white border border-amber-100 rounded-lg p-6">
        <div className="space-y-1">
          <Label htmlFor="display_name">이름</Label>
          <Input id="display_name" name="display_name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">연락처</Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="temp_password">임시 비밀번호 (8자+)</Label>
          <Input
            id="temp_password"
            name="temp_password"
            type="password"
            minLength={8}
            required
          />
          <p className="text-xs text-slate-500">
            선생님에게 직접 전달. 첫 로그인 후 변경하도록 안내.
          </p>
        </div>
        <Button type="submit" className="w-full">등록</Button>
      </form>
    </div>
  )
}
