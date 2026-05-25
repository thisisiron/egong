'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-lg font-semibold">치명적 오류</h2>
          <p className="text-sm text-slate-500">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
