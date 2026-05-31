'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  createSessionAction,
  updateSessionAction,
} from '@/lib/sessions/actions'
import type { Session, TeachingClassOption } from '@/lib/sessions/types'

// Discriminated union — edit 모드에서는 `existing`이 컴파일타임에 강제됨.
// (이전 단일 Props 타입은 edit + existing=undefined를 허용해 submit()이 silent no-op
// 되는 결함이 있었음.)
type CreateProps = {
  mode: 'create'
  // class_id를 props로 받거나 (원장: 반 컨텍스트 있음),
  // teachingClasses 옵션으로 드롭다운 보여주거나 (선생님).
  classId?: string
  teachingClasses?: TeachingClassOption[]
  trigger: ReactNode
}

type EditProps = {
  mode: 'edit'
  existing: Session
  trigger: ReactNode
}

type Props = CreateProps | EditProps

/** 다음 정각 (예: 14:23 → 15:00) — datetime-local 기본값. */
function nextHourLocal(): string {
  const d = new Date()
  d.setHours(d.getHours() + 1, 0, 0, 0)
  // 'YYYY-MM-DDTHH:mm' 로컬 시각
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO timestamp → 로컬 'YYYY-MM-DDTHH:mm' 변환 (datetime-local 표시용). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function SessionEditDialog(props: Props) {
  const { mode, trigger } = props
  // 모드별 props 접근 (TS narrowing). Create에만 있는 필드는 props.mode === 'create'에서 꺼냄.
  const existing = mode === 'edit' ? props.existing : undefined
  const classId = mode === 'create' ? props.classId : undefined
  const teachingClasses = mode === 'create' ? props.teachingClasses : undefined

  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [selectedClassId, setSelectedClassId] = useState<string>(
    classId ?? existing?.class_id ?? teachingClasses?.[0]?.id ?? ''
  )
  const [title, setTitle] = useState(existing?.title ?? '')
  const [scheduledAt, setScheduledAt] = useState(
    existing ? isoToLocalInput(existing.scheduled_at) : nextHourLocal()
  )
  const [unit, setUnit] = useState(existing?.unit ?? '')
  const [videoUrl, setVideoUrl] = useState(existing?.video_url ?? '')
  const [videoNotes, setVideoNotes] = useState(existing?.video_notes ?? '')

  // open이 true로 바뀔 때마다 폼 필드를 초기 상태로 re-seed.
  // edit 모드: existing.* 으로 다시 채워 stale 값 (사용자가 타이핑 후 취소한 값) 제거.
  // create 모드: error만 클리어 — selectedClassId 등 드롭다운 선택은 유지.
  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && existing) {
      setTitle(existing.title)
      setScheduledAt(isoToLocalInput(existing.scheduled_at))
      setUnit(existing.unit ?? '')
      setVideoUrl(existing.video_url ?? '')
      setVideoNotes(existing.video_notes ?? '')
    }
  }, [open, mode, existing])

  function reset() {
    setError(null)
    if (mode === 'create') {
      setTitle('')
      setScheduledAt(nextHourLocal())
      setUnit('')
    }
  }

  function submit() {
    setError(null)
    // TZ fix: 브라우저 로컬 시각을 ISO(UTC)로 변환해서 서버에 전달.
    // 서버는 Node 프로세스 TZ에 무관하게 정확한 시각을 받음.
    const isoScheduledAt = new Date(scheduledAt).toISOString()

    startTransition(async () => {
      try {
        if (mode === 'create') {
          await createSessionAction({
            class_id: selectedClassId,
            title,
            scheduled_at: isoScheduledAt,
            unit: unit.trim() || null,
          })
        } else {
          // TS narrows: mode === 'edit' ⇒ props.existing is Session (non-null).
          await updateSessionAction({
            id: props.existing.id,
            title,
            scheduled_at: isoScheduledAt,
            unit: unit.trim() || null,
            video_url: videoUrl.trim() || null,
            video_notes: videoNotes.trim() || null,
          })
        }
        setOpen(false)
        reset()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v) reset()
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '수업 추가' : '수업 수정'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '새 수업 회차를 만듭니다.'
              : '회차 정보를 수정합니다.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="space-y-3">
            {mode === 'create' && teachingClasses && teachingClasses.length > 0 && !classId && (
              <div className="space-y-1">
                <Label htmlFor="class_id">반</Label>
                <select
                  id="class_id"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  required
                >
                  {teachingClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="title">수업 제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 6/3 정물 드로잉"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="scheduled_at">수업 시각</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="unit">단원 (선택)</Label>
              <Input
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="예: 1단원 - 선과 면"
                maxLength={50}
              />
            </div>

            {mode === 'edit' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="video_url">영상 URL (선택)</Label>
                  <Input
                    id="video_url"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="video_notes">영상 메모 (선택)</Label>
                  <Textarea
                    id="video_notes"
                    value={videoNotes}
                    onChange={(e) => setVideoNotes(e.target.value)}
                    placeholder="회차 요약·코멘트"
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </>
            )}

            {error && (
              <div role="alert" aria-live="polite" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending || !selectedClassId}>
              {pending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
