'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeKR } from '@/lib/format'
import { deleteAnnouncementAction, updateAnnouncementAction } from '../actions'
import { updateAnnouncementSchema } from '../schemas'
import type { AnnouncementWithClass } from '../types'

type Props = {
  announcement: AnnouncementWithClass
  /** owner는 전부 true, teacher는 본인 작성분만 true, /me는 false */
  canManage: boolean
}

export function AnnouncementCard({ announcement: a, canManage }: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('id', a.id) // hidden input 대신 명시 — 서버 액션이 id를 파싱함

    // 클라이언트 선검증 — 프로덕션에서 서버 throw 메시지가 마스킹되므로 여기서 친절한 에러
    const parsed = updateAnnouncementSchema.safeParse({
      id: a.id,
      title: formData.get('title'),
      body: formData.get('body'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 확인해주세요.')
      return
    }

    startTransition(async () => {
      try {
        await updateAnnouncementAction(formData)
        setEditing(false)
        setError(null)
      } catch (err) {
        // 폼은 열린 채 유지 — 입력 유실 방지
        setError(err instanceof Error ? err.message : '수정에 실패했습니다.')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('id', a.id)
        await deleteAnnouncementAction(fd)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <article className="bg-white border border-amber-100 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            a.class_id
              ? 'bg-slate-100 text-slate-600'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {/* 반별 공지인데 RLS로 반 이름을 못 읽는 경우(teacher의 비담당 반) → 중립 표기 */}
          {a.class_id ? (a.class_name ?? '반 공지') : '학원 전체'}
        </span>
        <span className="text-xs text-slate-400">
          {a.author_name} · {formatDateTimeKR(a.created_at)}
        </span>
        <div className="flex-1" />
        {canManage && !editing ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-slate-500 hover:underline"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              삭제
            </button>
          </>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={handleEditSubmit} className="space-y-2">
          <Input name="title" defaultValue={a.title} required maxLength={200} />
          <Textarea name="body" defaultValue={a.body} required rows={4} maxLength={5000} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? '저장 중…' : '저장'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditing(false)
                setError(null)
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <>
          <h3 className="font-semibold">{a.title}</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.body}</p>
        </>
      )}

      {error ? (
        <div role="alert" className="text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </article>
  )
}
