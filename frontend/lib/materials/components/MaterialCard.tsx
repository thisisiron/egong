'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { deleteMaterialAction, updateMaterialAction } from '../actions'
import { updateMaterialSchema } from '../schemas'
import type { MaterialWithClass, SignedMaterialFile } from '../types'

type Props = {
  material: MaterialWithClass
  files: SignedMaterialFile[]
  canManage: boolean
}

export function MaterialCard({ material, files, canManage }: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('id', material.id) // hidden input 대신 명시 — 서버 액션이 id를 파싱함

    // 클라이언트 선검증 — 프로덕션에서 서버 throw 메시지가 마스킹되므로 여기서 친절한 에러
    const parsed = updateMaterialSchema.safeParse({
      id: material.id,
      title: formData.get('title'),
      description: formData.get('description'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 확인해주세요.')
      return
    }

    startTransition(async () => {
      try {
        await updateMaterialAction(formData)
        setEditing(false)
        setError(null)
      } catch (err) {
        // 폼은 열린 채 유지 — 입력 유실 방지
        setError(err instanceof Error ? err.message : '수정에 실패했습니다.')
      }
    })
  }

  function handleDelete() {
    if (!confirm('이 자료를 삭제할까요? 첨부 파일도 함께 삭제됩니다.')) return
    const fd = new FormData()
    fd.set('id', material.id)
    startTransition(async () => {
      try {
        await deleteMaterialAction(fd)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <article
      data-material-title={material.title}
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            material.class_id
              ? 'bg-slate-100 text-slate-600'
              : 'bg-indigo-100 text-indigo-700'
          }`}
        >
          {/* 반별 자료인데 RLS로 반 이름을 못 읽는 경우(teacher의 비담당 반) → 중립 표기 */}
          {material.class_id ? (material.class_name ?? '반 자료') : '학원 전체'}
        </span>
        {!editing && <h3 className="font-medium">{material.title}</h3>}
        {canManage && !editing && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
              수정
            </Button>
            <Button variant="ghost" onClick={handleDelete} disabled={pending} className="text-red-600">
              {pending ? '삭제 중…' : '삭제'}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleEditSubmit} className="space-y-2">
          <Input name="title" defaultValue={material.title} required maxLength={200} />
          <Textarea
            name="description"
            defaultValue={material.description ?? ''}
            rows={3}
            maxLength={5000}
          />
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
        material.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{material.description}</p>
        )
      )}

      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}

      <ul className="space-y-1">
        {files.map((f) =>
          f.url ? (
            <li key={f.path}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-600 hover:underline break-all"
              >
                📎 {f.name}
              </a>
            </li>
          ) : (
            <li key={f.path} className="text-sm text-slate-400 break-all">
              📎 {f.name} — 다운로드 링크를 만들 수 없습니다
            </li>
          )
        )}
        {files.length === 0 && <li className="text-xs text-slate-400">첨부 없음</li>}
      </ul>

      <p className="text-xs text-slate-400">
        {material.author_name} · {new Date(material.created_at).toLocaleDateString('ko-KR')}
      </p>
    </article>
  )
}
