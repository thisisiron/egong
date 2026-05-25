import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">페이지를 찾을 수 없습니다</h2>
      <Link href="/" className="text-sm text-blue-600 underline">
        홈으로
      </Link>
    </div>
  )
}
