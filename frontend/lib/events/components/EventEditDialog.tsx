'use client'

import { useState, useTransition, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createEventAction, updateEventAction } from '../actions'
import type { EventType, ScheduleEvent } from '../types'

type ClassOption = { id: string; name: string }

type CreateProps = {
  mode: 'create'
  classes: ClassOption[]        // 선택 가능한 반 목록 (owner=전체, teacher=담당)
  allowAcademyWide: boolean     // owner만 '학원 전체' 옵션 노출
  defaultDate?: string          // 'YYYY-MM-DD'
  trigger: ReactNode
}
type EditProps = {
  mode: 'edit'
  existing: ScheduleEvent
  classes: ClassOption[]
  allowAcademyWide: boolean
  trigger: ReactNode
}
type Props = CreateProps | EditProps

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function EventEditDialog(props: Props) {
  const { mode, trigger, classes, allowAcademyWide } = props
  const existing = mode === 'edit' ? props.existing : undefined

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [type, setType] = useState<EventType>(existing?.type ?? 'exam')
  const [title, setTitle] = useState(existing?.title ?? '')
  const [eventDate, setEventDate] = useState(
    existing?.event_date ?? (mode === 'create' ? props.defaultDate ?? todayStr() : todayStr())
  )
  const [classId, setClassId] = useState<string>(existing?.class_id ?? '')
  const [memo, setMemo] = useState(existing?.memo ?? '')

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createEventAction({ type, title, event_date: eventDate, class_id: classId || null, memo: memo || null })
        } else {
          await updateEventAction({ id: props.existing.id, type, title, event_date: eventDate, class_id: classId || null, memo: memo || null })
        }
        setOpen(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '일정 추가' : '일정 수정'}</DialogTitle>
          <DialogDescription>시험·상담 등 일정을 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit() }}>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="event_type">종류</Label>
              <select id="event_type" value={type} onChange={(e) => setType(e.target.value as EventType)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="exam">시험</option>
                <option value="consultation">상담</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_title">제목</Label>
              <Input id="event_title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 중간고사" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_date">날짜</Label>
              <Input id="event_date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_class">반</Label>
              <select id="event_class" value={classId} onChange={(e) => setClassId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                {allowAcademyWide && <option value="">학원 전체</option>}
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="event_memo">메모 (선택)</Label>
              <Textarea id="event_memo" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} rows={2} />
            </div>
            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>취소</Button>
            <Button type="submit" disabled={pending || (!classId && !allowAcademyWide)}>
              {pending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
