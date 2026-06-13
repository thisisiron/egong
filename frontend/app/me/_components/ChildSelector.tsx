'use client'
import { useRouter, useSearchParams } from 'next/navigation'

type Child = { id: string; name: string; grade: string | null }

export function ChildSelector({
  items,
  current,
  basePath = '/me',
}: {
  items: Child[]
  current: string
  basePath?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  if (items.length <= 1) return null
  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString())
        next.set('child', e.target.value)
        router.push(`${basePath}?${next.toString()}`)
      }}
      className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
    >
      {items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.grade ? ` (${c.grade})` : ''}
        </option>
      ))}
    </select>
  )
}
