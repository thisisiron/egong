'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { generateSessionsAction } from '../schedule-actions'

const WEEKDAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
]

export function ScheduleGenerator({ classId }: { classId: string }) {
  const [days, setDays] = useState<number[]>([])
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResult(null)
    setError(null)
    const form = new FormData(e.currentTarget)
    try {
      const r = await generateSessionsAction({
        class_id: classId,
        from_date: String(form.get('from_date')),
        to_date: String(form.get('to_date')),
        time_of_day: String(form.get('time_of_day')),
        title_prefix: String(form.get('title_prefix') || '수업'),
        weekdays: days,
      })
      setResult(`${r.created}회차 생성됨`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    }
  }

  return (
    <section className="bg-white border rounded-lg p-6 space-y-3">
      <h2 className="font-semibold">수업 일정 일괄 생성</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="from_date">시작일</Label>
            <Input id="from_date" name="from_date" type="date" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to_date">종료일</Label>
            <Input id="to_date" name="to_date" type="date" required />
          </div>
        </div>
        <div className="space-y-1">
          <Label>수업 요일 (다중 선택)</Label>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={`px-3 py-2 rounded text-sm border ${
                  days.includes(d.value)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="time_of_day">수업 시간 (HH:MM)</Label>
            <Input
              id="time_of_day"
              name="time_of_day"
              type="time"
              required
              defaultValue="19:00"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="title_prefix">회차 제목 접두어</Label>
            <Input id="title_prefix" name="title_prefix" placeholder="수업" />
          </div>
        </div>
        <Button type="submit" disabled={days.length === 0}>
          생성
        </Button>
        {result ? <p className="text-sm text-green-700">{result}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </section>
  )
}
