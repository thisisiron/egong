type Props = {
  rate: number | null
  present: number
  late: number
  absent: number
}

export function AttendanceStats({ rate, present, late, absent }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-amber-100 border border-amber-200 rounded-lg p-4 text-center">
        <div className="text-xs text-amber-900">출석률 (이번 달)</div>
        <div className="text-3xl font-bold text-slate-900 mt-1">
          {rate === null ? '-' : `${rate}%`}
        </div>
      </div>
      <div className="bg-white border border-amber-100 rounded-lg p-4">
        <div className="text-xs text-slate-600 text-center mb-2">이번 달 출결</div>
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
