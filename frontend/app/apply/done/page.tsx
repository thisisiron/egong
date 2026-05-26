import Link from 'next/link'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: '신청 접수 완료 — Egong',
}

export default function ApplyDonePage() {
  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <Logo />
        </div>
      </nav>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md bg-white border border-amber-100 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">🥚</div>
          <h1 className="text-2xl font-bold text-slate-900">신청이 접수되었습니다</h1>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            영업일 기준 2일 이내 입력하신 이메일·연락처로 안내드립니다.
            <br />
            추가 문의는 <strong>support@egong.kr</strong>로 부탁드립니다.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline">로그인 페이지로 →</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
