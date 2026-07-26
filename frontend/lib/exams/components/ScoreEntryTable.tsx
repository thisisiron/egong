'use client'

import { useState, useTransition } from 'react'

import { saveExamScoresAction } from '../actions'
import { toPercent, type ExamRosterRow } from '../types'

type Props = {
  examId: string
  maxScore: number
  roster: ExamRosterRow[]
}

type Draft = { score: string; is_absent: boolean; memo: string }

/**
 * 컴팩트 행 리스트 — 학생명 + 점수칸 + 미응시 토글이 한 줄.
 * 모바일·데스크탑 같은 마크업으로 동작한다(반응형 분기 없음).
 * 저장은 일괄 — 선생님이 여러 줄 넣다가 한 번 누른다.
 */
export function ScoreEntryTable({ examId, maxScore, roster }: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      roster.map((r) => [
        r.student_id,
        {
          score: r.score === null ? '' : String(r.score),
          is_absent: r.is_absent,
          memo: r.memo ?? '',
        },
      ])
    )
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const missingCount = roster.filter((r) => {
    const d = drafts[r.student_id]
    return !d.is_absent && d.score.trim() === ''
  }).length

  function update(studentId: string, patch: Partial<Draft>) {
    setSaved(false)
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }))
  }

  function toggleAbsent(studentId: string) {
    const next = !drafts[studentId].is_absent
    // 미응시로 바꾸면 점수를 비운다 — DB CHECK와 같은 규칙을 화면에서도 지킨다.
    update(studentId, { is_absent: next, score: next ? '' : drafts[studentId].score })
  }

  function save() {
    setError(null)
    const rows = roster.map((r) => {
      const d = drafts[r.student_id]
      return {
        student_id: r.student_id,
        score: d.is_absent || d.score.trim() === '' ? null : Number(d.score),
        is_absent: d.is_absent,
        memo: d.memo.trim() === '' ? null : d.memo,
      }
    })
    const fd = new FormData()
    fd.set('exam_id', examId)
    fd.set('rows', JSON.stringify(rows))
    startTransition(async () => {
      try {
        await saveExamScoresAction(fd)
        setSaved(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
      }
    })
  }

  if (roster.length === 0) {
    return (
      <p className="text-sm text-slate-400 bg-white border border-gray-200 rounded-lg p-6 text-center">
        시험일 기준으로 이 반에 배정된 학생이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {roster.map((r, i) => {
          const d = drafts[r.student_id]
          const isMissing = !d.is_absent && d.score.trim() === ''
          const pct =
            !d.is_absent && d.score.trim() !== ''
              ? toPercent(Number(d.score), maxScore)
              : null
          return (
            <div
              key={r.student_id}
              className={`flex items-center gap-2 px-3 py-2.5 ${
                i < roster.length - 1 ? 'border-b border-slate-100' : ''
              } ${isMissing ? 'bg-amber-50' : ''} ${d.is_absent ? 'opacity-65' : ''}`}
            >
              <span className="flex-1 text-sm text-slate-900 truncate">{r.student_name}</span>

              {d.is_absent ? (
                <span className="text-xs px-2.5 py-1 rounded-md bg-red-100 text-red-700">
                  미응시
                </span>
              ) : (
                <>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={maxScore}
                    step="0.5"
                    value={d.score}
                    onChange={(ev) => update(r.student_id, { score: ev.target.value })}
                    aria-label={`${r.student_name} 점수`}
                    className={`w-16 rounded-md border px-2 py-1 text-sm text-center ${
                      isMissing ? 'border-dashed border-slate-300' : 'border-slate-200'
                    }`}
                  />
                  <span className="w-10 text-xs text-slate-400">/ {maxScore}</span>
                  <span className="w-12 text-xs text-right text-slate-600 tabular-nums">
                    {pct === null ? '—' : `${pct}%`}
                  </span>
                </>
              )}

              <button
                type="button"
                onClick={() => toggleAbsent(r.student_id)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              >
                {d.is_absent ? '해제' : '미응시'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={`text-xs ${missingCount > 0 ? 'text-amber-700' : 'text-green-600'}`}>
          {missingCount > 0
            ? `미입력 ${missingCount}명 — 공개하려면 모두 채우거나 미응시로 표시해야 합니다`
            : '전원 입력 완료'}
        </span>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">저장됨</span>}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
