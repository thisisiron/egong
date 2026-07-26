'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type UploadedFile = { path: string; name: string }

type Props = {
  bucket: string
  /** 업로드 경로 접두사 (끝 슬래시 없이). 예: 'pending' 또는 `${academyId}/${assignmentId}/${studentId}` */
  pathPrefix: string
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
  /** 업로드 진행 여부를 부모에 알린다(선택). pathPrefix가 폼 입력에 의존할 때
   *  업로드 중 그 입력을 잠가야 경로-범위 불일치(경합)를 막을 수 있다. */
  onUploadingChange?: (uploading: boolean) => void
  multiple?: boolean
  accept?: string
  maxBytes?: number
  allowedMimes?: string[]
}

const DEFAULT_MIMES = ['image/png', 'image/jpeg', 'application/pdf']

export function StorageFileUpload({
  bucket,
  pathPrefix,
  value,
  onChange,
  onUploadingChange,
  multiple = false,
  accept = 'image/png,image/jpeg,application/pdf',
  maxBytes = 5 * 1024 * 1024,
  allowedMimes = DEFAULT_MIMES,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** uploading 상태는 부모도 알아야 한다(경로 잠금) — 항상 이 함수로만 바꾼다. */
  function updateUploading(next: boolean) {
    setUploading(next)
    onUploadingChange?.(next)
  }

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setError(null)
    for (const f of files) {
      if (f.size > maxBytes) { setError(`파일 크기는 ${Math.round(maxBytes / 1024 / 1024)}MB 이하여야 합니다`); return }
      if (!allowedMimes.includes(f.type)) { setError('PNG, JPG, PDF 파일만 업로드 가능합니다'); return }
    }
    updateUploading(true)
    try {
      const supabase = createClient()
      const uploaded: UploadedFile[] = []
      for (const f of files) {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? 'bin'
        const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, { contentType: f.type, upsert: false })
        if (upErr) { setError(`업로드 실패: ${upErr.message}`); return }
        uploaded.push({ path, name: f.name })
      }
      onChange(multiple ? [...value, ...uploaded] : uploaded.slice(0, 1))
    } finally {
      updateUploading(false)
      e.target.value = ''
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((f, i) => (
            <li key={f.path} className="flex items-center gap-2 text-sm text-slate-700">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => removeAt(i)} className="text-xs text-red-600 hover:underline">제거</button>
            </li>
          ))}
        </ul>
      )}
      <label className="cursor-pointer inline-block">
        <input type="file" accept={accept} multiple={multiple} onChange={handleSelect} disabled={uploading} className="hidden" />
        <span className={`inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${uploading ? 'bg-slate-100 text-slate-400 cursor-wait' : 'border border-slate-200 bg-white text-slate-700 hover:bg-gray-50'}`}>
          {uploading ? '업로드 중...' : multiple ? '파일 추가' : value.length ? '다른 파일 선택' : '파일 첨부'}
        </span>
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
