'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StorageFileUpload, type UploadedFile } from '@/components/ui/StorageFileUpload'
import { NOTIFY_ROLES } from '@/lib/notifications/types'
import { createMaterialAction } from '../actions'
import { createMaterialSchema } from '../schemas'
import type { ScopeOption } from '../types'

type Props = {
  academyId: string
  scopeOptions: ScopeOption[]
  onSuccess?: () => void
}

export function MaterialForm({ academyId, scopeOptions, onSuccess }: Props) {
  const [classId, setClassId] = useState('')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scopeNotice, setScopeNotice] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  // 파일은 storage 경로 {academy}/{class_id|'all'}/{uuid}.{ext}에 선택 즉시 업로드된다.
  // 업로드 후 대상(반)을 바꾸면 이미 올라간 파일이 옛 경로(prefix)에 남아, 옛 대상 멤버는
  // 볼 수 있고(유출) 새 대상 멤버는 못 보는(첨부 깨짐) 상태가 된다 → 첨부를 비우고 재첨부 안내.
  // 업로드가 아직 진행 중이면 files가 비어 있어 이 가드가 헛돌기 때문에(경합),
  // 진행 중에는 select 자체를 잠근다(아래 disabled={uploading}).
  function handleClassChange(nextClassId: string) {
    setScopeNotice(null)
    setClassId(nextClassId)
    if (files.length > 0) {
      setFiles([])
      setScopeNotice('대상을 바꿔 첨부 파일을 초기화했습니다. 다시 첨부해주세요.')
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)

    // 클라이언트 선검증 — 프로덕션에서 서버 throw 메시지가 마스킹되므로 여기서 친절한 에러
    // files는 아직 배열 상태(state)로 검증 — 액션에는 JSON 문자열로 실어 보낸다
    const parsed = createMaterialSchema.safeParse({
      class_id: classId,
      title: fd.get('title'),
      description: fd.get('description'),
      files,
      notify_roles: fd.getAll('notify_roles'),
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? '입력을 확인해주세요.')
      return
    }

    // disabled된 select는 FormData에 값을 싣지 않는다(업로드 중 잠금 때문에 발생 가능).
    // 화면 상태(classId)를 단일 진실 소스로 삼아 명시적으로 실어 보낸다 — files와 동일한 패턴.
    fd.set('class_id', classId)
    fd.set('files', JSON.stringify(files))

    startTransition(async () => {
      try {
        await createMaterialAction(fd)
        setError(null)
        form.reset()
        setClassId('')
        setFiles([])
        setScopeNotice(null)
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : '자료 등록에 실패했습니다.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="mat-class">대상</Label>
        <select
          id="mat-class"
          name="class_id"
          value={classId}
          onChange={(e) => handleClassChange(e.target.value)}
          disabled={uploading}
          className="w-full border rounded px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">학원 전체</option>
          {scopeOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {uploading && <p className="text-xs text-slate-500">업로드 중에는 대상을 바꿀 수 없습니다</p>}
      </div>

      {scopeNotice && <div role="status" className="text-sm text-amber-600">{scopeNotice}</div>}

      <div className="space-y-1">
        <Label htmlFor="mat-title">제목</Label>
        <Input id="mat-title" name="title" required maxLength={200} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="mat-desc">설명 (선택)</Label>
        <Textarea id="mat-desc" name="description" rows={3} maxLength={5000} />
      </div>

      <div className="space-y-1">
        <Label>파일</Label>
        <StorageFileUpload
          bucket="material-files"
          pathPrefix={`${academyId}/${classId || 'all'}`}
          value={files}
          onChange={setFiles}
          onUploadingChange={setUploading}
          multiple
          maxBytes={10 * 1024 * 1024}
        />
      </div>

      <div className="space-y-1">
        <Label>알림 받을 대상</Label>
        <div className="flex flex-wrap gap-2">
          {NOTIFY_ROLES.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
            >
              <input
                type="checkbox"
                name="notify_roles"
                value={r.value}
                defaultChecked={r.value === 'student' || r.value === 'parent'}
                className="accent-indigo-600"
              />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      {/* 업로드 중 제출하면 files가 아직 비어 있어 첨부 없는 자료가 등록된다 — 함께 잠근다. */}
      <Button type="submit" disabled={pending || uploading}>
        {pending ? '등록 중…' : uploading ? '업로드 중…' : '자료 올리기'}
      </Button>
    </form>
  )
}
