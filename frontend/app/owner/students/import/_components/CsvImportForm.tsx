'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import { uploadStudentsCsvAction, type ImportActionResult } from '../actions'

export function CsvImportForm() {
  const router = useRouter()
  const [result, setResult] = useState<ImportActionResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setResult(null)
    const form = new FormData(e.currentTarget)
    const r = await uploadStudentsCsvAction(form)
    setResult(r)
    setBusy(false)
    if (r.ok) {
      router.refresh()
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="file">csv 파일</Label>
        <input
          id="file"
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm border rounded p-2 bg-white"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? '업로드 중...' : '업로드'}
      </Button>
      {result && (
        <div
          className={`text-sm p-3 rounded ${
            result.ok
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {result.message}
        </div>
      )}
    </form>
  )
}
