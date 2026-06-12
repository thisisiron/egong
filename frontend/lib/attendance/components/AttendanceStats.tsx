type Props = {
  rate: number | null
  present: number
  late: number
  absent: number
  /** 기간 라벨 — 기본 '이번 달', 월 이동 시 '2026년 5월' 등 */
  label?: string
}

export function AttendanceStats({ rate, present, late, absent, label = '이번 달' }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-center">
        <div className="text-xs text-indigo-900">출석률 ({label})</div>
        <div className="text-3xl font-bold text-slate-900 mt-1">
          {rate === null ? '-' : `${rate}%`}
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-xs text-slate-600 text-center mb-2">{label} 출결</div>
        <div className="flex justify-around text-center">
          <div>
            <div className="text-xl font-semibold text-green-700">{present}</div>
            <div className="text-xs text-slate-500">출석</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-amber-700">{late}</div>
            <div className="text-xs text-slate-500">지각</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-red-600">{absent}</div>
            <div className="text-xs text-slate-500">결석</div>
          </div>
        </div>
      </div>
    </div>
  )
}
