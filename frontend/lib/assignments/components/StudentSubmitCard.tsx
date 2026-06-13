'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StorageFileUpload, type UploadedFile } from '@/components/ui/StorageFileUpload'
import { submitAssignmentAction } from '../actions'
import type { AssignmentSubmission } from '../types'

type Props = {
  assignmentId: string
  academyId: string
  studentId: string
  existing: AssignmentSubmission | null
  existingFiles: Array<{ path: string; name: string }>
}

export function StudentSubmitCard({ assignmentId, academyId, studentId, existing, existingFiles }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (files.length === 0) { setError('파일을 1개 이상 첨부해주세요.'); return }
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('assignment_id', assignmentId)
    files.forEach((f) => fd.append('file_paths', f.path))
    startTransition(async () => {
      try {
        await submitAssignmentAction(fd)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '제출에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="text-sm font-medium">{existing ? '내 제출물 (다시 제출하면 덮어쓰기)' : '제출하기'}</div>
      <StorageFileUpload
        bucket="assignment-submissions"
        pathPrefix={`${academyId}/${assignmentId}/${studentId}`}
        value={files}
        onChange={setFiles}
        multiple
        maxBytes={10 * 1024 * 1024}
      />
      <Textarea name="memo" rows={2} maxLength={2000} placeholder="메모 (선택)" defaultValue={existing?.memo ?? ''} />
      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      <Button type="submit" disabled={pending}>{pending ? '제출 중…' : existing ? '다시 제출' : '제출'}</Button>
    </form>
  )
}
