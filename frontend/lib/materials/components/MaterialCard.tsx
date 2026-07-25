'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { deleteMaterialAction } from '../actions'
import type { MaterialWithClass, SignedMaterialFile } from '../types'

type Props = {
  material: MaterialWithClass
  files: SignedMaterialFile[]
  canManage: boolean
}

export function MaterialCard({ material, files, canManage }: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('이 자료를 삭제할까요? 첨부 파일도 함께 삭제됩니다.')) return
    const fd = new FormData()
    fd.set('id', material.id)
    startTransition(async () => {
      try {
        await deleteMaterialAction(fd)
      } catch (err) {
        alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
      }
    })
  }

  return (
    <article className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
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
        <h3 className="font-medium">{material.title}</h3>
        {canManage && (
          <Button variant="ghost" onClick={handleDelete} disabled={pending} className="ml-auto text-red-600">
            {pending ? '삭제 중…' : '삭제'}
          </Button>
        )}
      </div>

      {material.description && (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{material.description}</p>
      )}

      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.path}>
            <a
              href={f.url ?? '#'}
              target="_blank"
              rel="noreferrer"
              download={f.name}
              className="text-sm text-indigo-600 hover:underline break-all"
            >
              📎 {f.name}
            </a>
          </li>
        ))}
        {files.length === 0 && <li className="text-xs text-slate-400">첨부 없음</li>}
      </ul>

      <p className="text-xs text-slate-400">
        {material.author_name} · {new Date(material.created_at).toLocaleDateString('ko-KR')}
      </p>
    </article>
  )
}
