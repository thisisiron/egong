import { notFound } from 'next/navigation'

import { getExamStats, getExamWithRoster } from '../service'
import { scoreEntryState } from '../types'
import { ExamAdminPanel } from './ExamAdminPanel'
import { PublishButton } from './PublishButton'
import { ScoreEntryTable } from './ScoreEntryTable'

type Props = { examId: string; basePath: string }

/** 점수 입력 화면 본문. owner·teacher 공용 — basePath는 삭제 후 목록으로 돌아가는 데 쓴다. */
export async function ExamDetailBody({ examId, basePath }: Props) {
  const data = await getExamWithRoster(examId)
  if (!data) notFound()

  const { exam, roster } = data
  const stats = await getExamStats(examId)
  const missingCount = roster.filter((r) => scoreEntryState(r) === 'missing').length

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold">{exam.title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {exam.class_name ?? '반 미지정'} · {exam.exam_date} · 만점 {exam.max_score}점
              {exam.exam_type && ` · ${exam.exam_type}`}
            </p>
            {exam.scope && <p className="mt-0.5 text-xs text-slate-500">범위: {exam.scope}</p>}
          </div>
          <PublishButton
            examId={exam.id}
            missingCount={missingCount}
            published={exam.published_at !== null}
          />
        </div>
        <div className="mt-3 flex gap-3 text-xs text-slate-600">
          <span>반 평균 {stats.avg_pct ?? '—'}%</span>
          <span>최고 {stats.max_pct ?? '—'}%</span>
          <span>응시 {stats.taker_count}명</span>
        </div>
      </div>

      <ScoreEntryTable examId={exam.id} maxScore={exam.max_score} roster={roster} />

      <ExamAdminPanel exam={exam} basePath={basePath} />
    </div>
  )
}
