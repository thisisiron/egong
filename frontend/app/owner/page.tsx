import { createClient } from '@/lib/supabase/server'

export default async function OwnerDashboard() {
  const supabase = await createClient()
  const [studentsRes, teachersRes, classesRes] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('classes').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">대시보드</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="학생" value={studentsRes.count ?? 0} />
        <Stat label="선생님" value={teachersRes.count ?? 0} />
        <Stat label="반" value={classesRes.count ?? 0} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  )
}
