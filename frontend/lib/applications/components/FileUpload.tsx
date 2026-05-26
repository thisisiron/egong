'use client'

import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'application/pdf']

type Props = {
  /** 업로드 완료 시 path 전달. 부모는 hidden input(name='registration_file_path')로 폼에 보냄. */
  onUploaded: (path: string | null) => void
  /** 현재 path (재업로드 / 표시용) */
  currentPath: string | null
  /** 선택 사항이면 안내 텍스트 다르게 */
  optional?: boolean
}

export function FileUpload({ onUploaded, currentPath, optional }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > MAX_BYTES) {
      setError('파일 크기는 5MB 이하여야 합니다')
      return
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      setError('PNG, JPG, PDF 파일만 업로드 가능합니다')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const path = `pending/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('business-docs')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (upErr) {
        setError(`업로드 실패: ${upErr.message}`)
        return
      }

      setFileName(file.name)
      onUploaded(path)
    } finally {
      setUploading(false)
    }
  }

  function handleClear() {
    setFileName(null)
    setError(null)
    onUploaded(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={handleSelect}
            disabled={uploading}
            className="hidden"
          />
          <span
            className={`inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${
              uploading
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-amber-50 hover:border-amber-300'
            }`}
          >
            {uploading ? '업로드 중...' : currentPath ? '다른 파일 선택' : '파일 첨부'}
          </span>
        </label>
        {currentPath && (
          <>
            <span className="text-sm text-slate-700">{fileName ?? '첨부됨'}</span>
            <Button type="button" variant="ghost" onClick={handleClear}>
              제거
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">
        PNG, JPG, PDF · 5MB 이하 {optional && '· 선택 사항'}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
