import { ApplicationForm } from '@/lib/applications/components/ApplicationForm'
import { Logo } from '@/components/Logo'

export const metadata = {
  title: '학원 도입 신청 — Egong',
  description: '학원 운영을 Egong과 함께. 도입 신청서를 제출해주세요.',
}

export default function ApplyPage() {
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center">
          <Logo />
          <div className="flex-1" />
          <a href="/login" className="text-sm text-slate-600 hover:text-slate-900">
            로그인 →
          </a>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            🥚 학원에 Egong 도입하기
          </h1>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            학원 운영 ERP + 학습관리를 한 곳에서. 아래 신청서를 작성하시면 영업일 기준 2일 이내
            확인 후 연락드립니다.
          </p>
        </header>
        <ApplicationForm />
      </main>
      <footer className="text-center text-xs text-slate-400 py-8">
        © 2026 Egong · 문의: support@egong.kr
      </footer>
    </div>
  )
}
