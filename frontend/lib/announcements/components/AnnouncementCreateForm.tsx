'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAnnouncementAction } from '../actions'
import { createAnnouncementSchema } from '../schemas'
import type { ScopeOption } from '../types'

type Props = {
  scopeOptions: ScopeOption[]
  /** owner만 true — "학원 전체" 옵션 노출 */
  allowAcademyWide: boolean
}

export function AnnouncementCreateForm({ scopeOptions, allowAcademyWide }: Props) {
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
