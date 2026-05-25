'use client'

import { useState, useTransition } from 'react'
import { upsertAttendanceAction } from '../actions'

type Status = 'present' | 'late' | 'absent' | 'excused'

type Props = {
  sessionId: string
  student: { id: string; name: string; school: string | null }
  initialStatus: Status | null
  initialReason: string | null
  initialNeedsMakeup: boolean
}

const STATUS_LABEL: Record<Status, string> = {
  present: '출',
  late: '지',
  absent: '결',
  excused: '연락',
}

const STATUS_COLOR: Record<Status, string> = {
  present: 'bg-green-500',
  late: 'bg-amber-500',
  absent: 'bg-red-500',
  excused: 'bg-indigo-500',
}

export function AttendanceRow(props: Props) {
  const [status, setStatus] = useState<Status | null>(props.initialStatus)
  const [reason, setReason] = useState(props.initialReason ?? '')
  const [needsMakeup, setNeedsMakeup] = useState(props.initialNeedsMakeup)
  const [pending, startTransition] = useTransition()

  function pick(next: Status) {
    setStatus(next)
    startTransition(() => {
      void upsertAttendanceAction({
        session_id: props.sessionId,
        student_id: props.student.id,
        status: next,
        excused_reason: next === 'excused' ? reason : null,
        needs_makeup: next === 'excused' ? needsMakeup : false,
      })
    })
  }

  function saveReason() {
    if (status !== 'excused') return
    startTransition(() => {
      void upsertAttendanceAction({
        session_id: props.sessionId,
        student_id: props.student.id,
        status: 'excused',
        excused_reason: reason,
        needs_makeup: needsMakeup,
      })
    })
  }

  return (
    <div
      className={`border rounded-lg p-3 ${
        status === 'excused'
          ? 'bg-indigo-50 border-indigo-200'
          : 'bg-white'
      } ${status ? '' : 'border-dashed'}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div
            className={`font-medium ${
              status ? 'text-slate-900' : 'text-slate-500'
            }`}
          >
            {props.student.name}
          </div>
          <div className="text-xs text-slate-500">
            {props.student.school ?? '-'}
          </div>
        </div>
        <div className="flex gap-1">
          {(['present', 'late', 'absent', 'excused'] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium ${
                status === s
                  ? `${STATUS_COLOR[s]} text-white`
                  : 'bg-slate-100 text-slate-500'
              }`}
              disabled={pending}
              aria-label={`${props.student.name} ${STATUS_LABEL[s]}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {status === 'excused' ? (
        <div className="mt-3 space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm bg-white"
            placeholder="결석 사유 (예: 학교 행사)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={saveReason}
          />
          <label className="flex items-center gap-2 text-xs text-indigo-700">
            <input
              type="checkbox"
              checked={needsMakeup}
              onChange={(e) => {
                setNeedsMakeup(e.target.checked)
                saveReason()
              }}
            />
            보강 필요로 표시
          </label>
        </div>
      ) : null}
    </div>
  )
}
