'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { RepeatFreq } from '@/lib/sessions/repeat'

export type RepeatFieldsValue = {
  fromDate: string
  toDate: string
  time: string
  freq: RepeatFreq
  weekdays: number[] // 0=Sun..6=Sat
  monthDays: number[] // 1..31
}

// 월~일 순서로 표시하되 값은 getDay() 기준.
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
]

const FREQ_OPTIONS: { value: RepeatFreq; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'biweekly', label: '격주' },
  { value: 'monthly', label: '매월' },
]

type Props = {
  value: RepeatFieldsValue
  onChange: (v: RepeatFieldsValue) => void
}

export function RepeatScheduleFields({ value, onChange }: Props) {
  const set = (patch: Partial<RepeatFieldsValue>) => onChange({ ...value, ...patch })

  const toggleWeekday = (d: number) =>
    set({
      weekdays: value.weekdays.includes(d)
        ? value.weekdays.filter((x) => x !== d)
        : [...value.weekdays, d],
    })

  const toggleMonthDay = (d: number) =>
    set({
      monthDays: value.monthDays.includes(d)
        ? value.monthDays.filter((x) => x !== d)
        : [...value.monthDays, d],
    })

  const showMonthlyWarning =
    value.freq === 'monthly' && value.monthDays.some((d) => d >= 29)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="from_date">시작일</Label>
          <Input
            id="from_date"
            type="date"
            value={value.fromDate}
            onChange={(e) => set({ fromDate: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to_date">종료일</Label>
          <Input
            id="to_date"
            type="date"
            value={value.toDate}
            onChange={(e) => set({ toDate: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="repeat_time">수업 시각</Label>
          <Input
            id="repeat_time"
            type="time"
            value={value.time}
            onChange={(e) => set({ time: e.target.value })}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="repeat_freq">반복</Label>
          <select
            id="repeat_freq"
            value={value.freq}
            onChange={(e) => set({ freq: e.target.value as RepeatFreq })}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            {FREQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {(value.freq === 'weekly' || value.freq === 'biweekly') && (
        <div className="space-y-1">
          <Label>요일</Label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={value.weekdays.includes(d.value)}
                onClick={() => toggleWeekday(d.value)}
                className={`px-3 py-2 rounded text-sm border ${
                  value.weekdays.includes(d.value)
                    ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.freq === 'monthly' && (
        <div className="space-y-1">
          <Label>날짜</Label>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={value.monthDays.includes(d)}
                onClick={() => toggleMonthDay(d)}
                className={`py-1.5 rounded text-xs border ${
                  value.monthDays.includes(d)
                    ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {showMonthlyWarning && (
            <p className="text-xs text-slate-500 mt-1">
              ⚠ 29·30·31일은 해당 일자가 없는 달(2월 등)에는 생성되지 않습니다.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
