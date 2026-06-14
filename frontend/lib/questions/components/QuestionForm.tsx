'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StorageFileUpload, type UploadedFile } from '@/components/ui/StorageFileUpload'
import { createQuestionAction } from '../actions'

type ClassOption = { id: string; name: string }

export function QuestionForm({ classOptions, academyId }: { classOptions: ClassOption[]; academyId: string }) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    files.forEach((f) => fd.append('file_paths', f.path))
    startTransition(async () => {
      try {
        await createQuestionAction(fd)
        setError(null)
        form.reset()
        setFiles([])
      } catch (err) {
        setError(err instanceof Error ? err.message : '질문 등록에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="q-class">반</Label>
        <select id="q-class" name="class_id" required defaultValue={classOptions[0]?.id ?? ''}
                className="w-full border rounded px-3 py-2 text-sm">
          {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="q-title">제목</Label>
        <Input id="q-title" name="title" required maxLength={200} placeholder="무엇이 궁금한가요?" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="q-body">내용</Label>
        <Textarea id="q-body" name="body" rows={4} required maxLength={5000} placeholder="질문을 자세히 적어주세요." />
      </div>
      <div className="space-y-1">
        <Label>사진/파일 첨부 (선택)</Label>
        <StorageFileUpload
          bucket="question-files"
          pathPrefix={academyId}
          value={files}
          onChange={setFiles}
          multiple
          maxBytes={10 * 1024 * 1024}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_public" className="accent-indigo-600" />
        같은 반 친구들도 볼 수 있게 공개
      </label>
      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      <Button type="submit" disabled={pending}>{pending ? '등록 중…' : '질문하기'}</Button>
    </form>
  )
}
