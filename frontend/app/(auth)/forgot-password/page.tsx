'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-amber-100 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">비밀번호 재설정</h1>
        {sent ? (
          <p className="text-sm text-green-700">{email}로 재설정 메일을 보냈습니다.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full">재설정 메일 보내기</Button>
          </form>
        )}
        <a href="/login" className="block text-sm text-slate-600 hover:underline text-center">로그인으로 돌아가기</a>
      </div>
    </div>
  )
}
