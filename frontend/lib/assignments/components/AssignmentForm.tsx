'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAssignmentAction } from '../actions'
import { ASSIGNMENT_NOTIFY_ROLES } from '../types'

type ClassOption = { id: string; name: string }

export function AssignmentForm({ classOptions, onSuccess }: { classOptions: ClassOption[]; onSuccess?: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const dueRaw = fd.get('due_at_local')
    fd.delete('due_at_local')
    if (typeof dueRaw === 'string' && dueRaw) fd.set('due_at', new Date(dueRaw).toISOString())
    startTransition(async () => {
      try {
        await createAssignmentAction(fd)
        setError(null)
        form.reset()
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : '과제 등록에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="asg-class">반</Label>
        <select id="asg-class" name="class_id" required defaultValue={classOptions[0]?.id ?? ''} className="w-full border rounded px-3 py-2 text-sm">
          {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="asg-title">제목</Label>
        <Input id="asg-title" name="title" required maxLength={200} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="asg-desc">설명 (선택)</Label>
        <Textarea id="asg-desc" name="description" rows={3} maxLength={5000} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="asg-due">마감일 (선택)</Label>
        <Input id="asg-due" name="due_at_local" type="datetime-local" />
      </div>
      <div className="space-y-1">
        <Label>알림 받을 대상</Label>
        <div className="flex flex-wrap gap-2">
          {ASSIGNMENT_NOTIFY_ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
              <input type="checkbox" name="notify_roles" value={r.value} defaultChecked className="accent-indigo-600" />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      <Button type="submit" disabled={pending}>{pending ? '등록 중…' : '과제 내기'}</Button>
    </form>
  )
}
