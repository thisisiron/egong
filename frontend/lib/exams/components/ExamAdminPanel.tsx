'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deleteExamAction, updateExamAction } from '../actions'
import type { ExamWithClass } from '../types'

type Props = { exam: ExamWithClass; basePath: string }

/**
 * 시험 수정·삭제. 기본은 접힌 상태 — 점수 입력이 이 화면의 주 작업이고 수정은 예외 상황이다.
 * 검증 규칙은 서버 액션이 소유한다(공개 후 시험일 고정, 만점 하향 제한). 여기서는
 * 서버가 던진 한국어 메시지를 그대로 보여준다.
 * 삭제가 성공하면 지금 보고 있는 상세 페이지 자체가 사라지므로(재조회 시 notFound()),
 * 목록으로 이동시킨다.
 */
export function ExamAdminPanel({ exam, basePath }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const published = exam.published_at !== null

  function submitUpdate(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await updateExamAction(formData)
      } catch (e) {
        setError(e instanceof Error ? e.message : '처리에 실패했습니다.')
      }
    })
  }

  function submitDelete(formData: FormData) {
    setError(null)
    startTransition(async () => {
      try {
        await deleteExamAction(formData)
        router.push(`${basePath}/exams`)
      } catch (e) {
        setError(e instanceof Error ? e.message : '처리에 실패했습니다.')
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 underline hover:text-slate-700"
      >
        시험 수정·삭제
      </button>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">시험 수정</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 underline hover:text-slate-700"
        >
          닫기
        </button>
      </div>

      <form action={submitUpdate} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={exam.id} />

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험 이름
          </span>
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={exam.title}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험일
          </span>
          <input
            type="date"
            name="exam_date"
            required
            defaultValue={exam.exam_date}
            readOnly={published}
            aria-describedby={published ? 'exam-date-locked' : undefined}
            className={`mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${
              published ? 'bg-slate-50 text-slate-500' : ''
            }`}
          />
          {published && (
            <span id="exam-date-locked" className="mt-1 block text-[11px] text-slate-500">
              공개된 시험은 시험일을 바꿀 수 없습니다
            </span>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">만점</span>
          <input
            type="number"
            name="max_score"
            required
            min={1}
            max={1000}
            step="0.5"
            defaultValue={exam.max_score}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            유형 (선택)
          </span>
          <input
            name="exam_type"
            maxLength={50}
            defaultValue={exam.exam_type ?? ''}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험 범위 (선택)
          </span>
          <input
            name="scope"
            maxLength={500}
            defaultValue={exam.scope ?? ''}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '저장 중…' : '수정 저장'}
          </button>
        </div>
      </form>

      <div className="border-t border-slate-100 pt-3">
        <form action={submitDelete}>
          <input type="hidden" name="id" value={exam.id} />
          <p className="text-xs text-slate-500">
            삭제하면 이 시험의 점수가 모두 함께 사라집니다
            {published && ' — 이미 공개돼 학생·학부모가 본 성적입니다'}.
          </p>
          <button
            type="submit"
            disabled={pending}
            onClick={(ev) => {
              if (!confirm(`"${exam.title}" 시험과 입력된 점수를 모두 삭제합니다. 계속할까요?`)) {
                ev.preventDefault()
              }
            }}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            시험 삭제
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
