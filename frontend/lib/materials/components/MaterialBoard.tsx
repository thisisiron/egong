'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { MaterialCard } from './MaterialCard'
import { MaterialForm } from './MaterialForm'
import type { MaterialWithClass, ScopeOption, SignedMaterialFile } from '../types'

type Props = {
  materials: MaterialWithClass[]
  /** materialId → 서명된 첨부들. 첨부가 없는 자료는 키 자체가 없을 수 있다 — 항상 ?? [] 로 접근 */
  signedFiles: Record<string, SignedMaterialFile[]>
  /** 업로드 경로 접두사(학원 id). canManage일 때만 사용 */
  academyId: string
  scopeOptions: ScopeOption[]
  canManage: boolean
}

export function MaterialBoard({ materials, signedFiles, academyId, scopeOptions, canManage }: Props) {
  const [composing, setComposing] = useState(false)

  if (canManage && composing) {
    return (
      <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">새 자료 올리기</h2>
          <Button variant="ghost" onClick={() => setComposing(false)}>목록으로</Button>
        </div>
        <MaterialForm
          academyId={academyId}
          scopeOptions={scopeOptions}
          onSuccess={() => setComposing(false)}
        />
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setComposing(true)}>자료 올리기</Button>
        </div>
      )}
      <div className="space-y-3">
        {materials.map((m) => (
          <MaterialCard
            key={m.id}
            material={m}
            files={signedFiles[m.id] ?? []}
            canManage={canManage}
          />
        ))}
        {materials.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12">등록된 자료가 없습니다.</p>
        )}
      </div>
    </div>
  )
}
