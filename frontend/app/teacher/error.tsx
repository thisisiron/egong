'use client'

export default function TeacherError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="p-8 max-w-md space-y-3">
      <p className="text-red-600 text-sm">오류: {error.message}</p>
      <button onClick={reset} className="text-sm text-blue-600 hover:underline">
        다시 시도
      </button>
    </div>
  )
}
