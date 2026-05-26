'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-lg font-semibold">오류가 발생했습니다</h2>
      <p className="text-sm text-slate-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-500"
      >
        다시 시도
      </button>
    </div>
  )
}
