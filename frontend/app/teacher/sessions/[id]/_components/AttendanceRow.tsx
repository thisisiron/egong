'use client'

import { useState, useTransition } from 'react'
import { upsertAttendanceAction } from '../actions'

type Status = 'present' | 'late' | 'absent' | 'excused'
type PickableStatus = 'present' | 'late' | 'absent'

type Props = {
  sessionId: string
  student: { id: string; name: string; school: string | null }
  initialStatus: Status | null
  initialReason: string | null
  initialNeedsMakeup: boolean
}

const STATUS_LABEL: Record<PickableStatus, string> = {
  present: '출',
  late: '지',
  absent: '결',
}

const STATUS_COLOR: Record<PickableStatus, string> = {
  present: 'bg-green-500',
  late: 'bg-amber-500',
  absent: 'bg-red-500',
}

// 레거시 'excused'(사전연락)는 'absent'로 정규화 — 결석으로 통일, 사유는 메모.
function normalize(s: Status | null): PickableStatus | null {
  return s === 'excused' ? 'absent' : s
}

export function AttendanceRow(props: Props) {
  const [status, setStatus] = useState<PickableStatus | null>(
    normalize(props.initialStatus)
  )
  const [reason, setReason] = useState(props.initialReason ?? '')
  const [needsMakeup, setNeedsMakeup] = useState(props.initialNeedsMakeup)
  const [pending, startTransition] = useTransition()

  function pick(next: PickableStatus) {
    setStatus(next)
    startTransition(() => {
      void upsertAttendanceAction({
        session_id: props.sessionId,
        student_id: props.student.id,
        status: next,
        // 결석일 때만 사유·보강 플래그 저장. 출/지면 비움.
        excused_reason: next === 'absent' ? reason.trim() || null : null,
        needs_makeup: next === 'absent' ? needsMakeup : false,
      })
    })
  }

  // 결석 메모·보강 플래그 저장. makeup은 인자로 받아 stale closure 회피.
  function persistAbsent(makeup: boolean) {
    if (status !== 'absent') return
    startTransition(() => {
      void upsertAttendanceAction({
        session_id: props.sessionId,
        student_id: props.student.id,
        status: 'absent',
        excused_reason: reason.trim() || null,
        needs_makeup: makeup,
      })
    })
  }

  return (
    <div
      className={`border rounded-lg p-3 ${
        status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-white'
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
          {(['present', 'late', 'absent'] as PickableStatus[]).map((s) => (
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
      {status === 'absent' ? (
        <div className="mt-3 space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm bg-white"
            placeholder="결석 사유 (선택 · 예: 학교 행사)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => persistAbsent(needsMakeup)}
          />
          <label className="flex items-center gap-2 text-xs text-red-700">
            <input
              type="checkbox"
              checked={needsMakeup}
              onChange={(e) => {
                setNeedsMakeup(e.target.checked)
                persistAbsent(e.target.checked)
              }}
            />
            보강 필요로 표시
          </label>
        </div>
      ) : null}
    </div>
  )
}
