import { countStudents } from '@/lib/students/service'
import { countTeachers } from '@/lib/teachers/service'
import { countClasses } from '@/lib/classes/service'
import { getTodaySessionsSummary } from '@/lib/attendance/service'
import { TodayAttendance } from '@/lib/attendance/components/TodayAttendance'

export default async function OwnerDashboard() {
  const [students, teachers, classes, today] = await Promise.all([
    countStudents(),
    countTeachers(),
    countClasses(),
    getTodaySessionsSummary(),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">대시보드</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="학생" value={students} />
        <Stat label="선생님" value={teachers} />
        <Stat label="반" value={classes} />
      </div>
      <section className="space-y-2">
        <h2 className="font-semibold">오늘 출결 현황</h2>
        <TodayAttendance items={today} />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-amber-100 rounded-lg p-5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </div>
  )
}
