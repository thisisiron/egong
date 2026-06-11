'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTimeKR } from '@/lib/format'
import { deleteAnnouncementAction, updateAnnouncementAction } from '../actions'
import type { AnnouncementWithClass } from '../types'

type Props = {
  announcement: AnnouncementWithClass
  /** owner는 전부 true, teacher는 본인 작성분만 true, /me는 false */
  canManage: boolean
}

export function AnnouncementCard({ announcement: a, canManage }: Props) {
  const [editing, setEditing] = useState(false)

  return (
    <article className="bg-white border border-amber-100 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            a.class_name
              ? 'bg-slate-100 text-slate-600'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {a.class_name ?? '학원 전체'}
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
            <form action={deleteAnnouncementAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className="text-sm text-red-600 hover:underline">삭제</button>
            </form>
          </>
        ) : null}
      </div>

      {editing ? (
        <form
          action={async (formData: FormData) => {
            await updateAnnouncementAction(formData)
            setEditing(false)
          }}
          className="space-y-2"
        >
          <input type="hidden" name="id" value={a.id} />
          <Input name="title" defaultValue={a.title} required maxLength={200} />
          <Textarea name="body" defaultValue={a.body} required rows={4} maxLength={5000} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">저장</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
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
    </article>
  )
}
