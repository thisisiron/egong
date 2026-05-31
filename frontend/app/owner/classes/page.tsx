import Link from 'next/link'
import { listClasses } from '@/lib/classes/service'
import { Button } from '@/components/ui/button'

export default async function ClassesPage() {
  const classes = await listClasses()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">반</h1>
        <Link href="/owner/classes/new">
          <Button>새 반 생성</Button>
        </Link>
      </div>
      <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-amber-50 text-left text-slate-700 border-b border-amber-200">
            <tr>
              <th className="px-4 py-3">반 이름</th>
              <th className="px-4 py-3">레벨</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100">
            {(!classes || classes.length === 0) ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  반이 없습니다.
                </td>
              </tr>
            ) : null}
            {(classes ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-amber-50/50">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.level}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/owner/classes/${c.id}`}
                    className="text-amber-700 hover:underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
