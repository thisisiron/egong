'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAnnouncementAction } from '../actions'
import { createAnnouncementSchema } from '../schemas'
import type { ScopeOption } from '../types'
import { NOTIFY_ROLES } from '@/lib/notifications/types'

type Props = {
  scopeOptions: ScopeOption[]
  /** owner만 true — "학원 전체" 옵션 노출 */
  allowAcademyWide: boolean
  /** 게시 성공 시 호출 (예: 목록으로 복귀) */
  onSuccess?: () => void
}

export function AnnouncementCreateForm({ scopeOptions, allowAcademyWide, onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // 클라이언트 선검증 — 프로덕션에서 서버 throw 메시지가 마스킹되므로 여기서 친절한 에러
    const parsed = createAnnouncementSchema.safeParse({
      title: formData.get('title'),
      body: formData.get('body'),
      class_id: formData.get('class_id') ?? '',
      notify_roles: formData.getAll('notify_roles'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 확인해주세요.')
      return
    }

    startTransition(async () => {
      try {
        await createAnnouncementAction(formData)
        setError(null)
        form.reset()
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : '공지 게시에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ann-class">대상</Label>
        <select
          id="ann-class"
          name="class_id"
          defaultValue={allowAcademyWide ? '' : (scopeOptions[0]?.id ?? '')}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {allowAcademyWide ? <option value="">학원 전체</option> : null}
          {scopeOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ann-title">제목</Label>
        <Input id="ann-title" name="title" required maxLength={200} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ann-body">내용</Label>
        <Textarea id="ann-body" name="body" required rows={4} maxLength={5000} />
      </div>
      <div className="space-y-1">
        <Label>알림 받을 대상</Label>
        <div className="flex flex-wrap gap-2">
          {NOTIFY_ROLES.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="checkbox"
                name="notify_roles"
                value={r.value}
                defaultChecked={r.value === 'student' || r.value === 'parent'}
                className="accent-indigo-600"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      {error ? (
        <div role="alert" className="text-sm text-red-600">
          {error}
        </div>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? '게시 중…' : '게시'}
      </Button>
    </form>
  )
}
