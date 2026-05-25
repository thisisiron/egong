import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { searchParams: Promise<{ error?: string; next?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border p-6 space-y-4">
        <h1 className="text-2xl font-semibold">로그인</h1>
        {error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {decodeURIComponent(error)}
          </div>
        ) : null}
        <form action={loginAction} className="space-y-3">
          <input type="hidden" name="next" value={next ?? ''} />
          <div className="space-y-1">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">비밀번호</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">로그인</Button>
        </form>
        <a href="/forgot-password" className="block text-sm text-slate-600 hover:underline text-center">
          비밀번호를 잊으셨나요?
        </a>
      </div>
    </div>
  )
}
