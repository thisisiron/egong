import Link from 'next/link'

import type { ExamListRow } from '../types'

type Props = { exams: ExamListRow[]; basePath: string }

/** 스태프 시험 목록. 진행도 3종: 완료(녹색)·진행 중(amber)·미입력(점선 회색). 출결 카드와 같은 언어. */
export function ExamList({ exams, basePath }: Props) {
  if (exams.length === 0) {
    return (
      <p className="text-sm text-slate-400 bg-white border border-gray-200 rounded-lg p-6 text-center">
        등록된 시험이 없습니다.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {exams.map((e) => {
        const published = e.published_at !== null
        const done = e.roster_count > 0 && e.recorded_count >= e.roster_count
        const untouched = e.recorded_count === 0
        return (
          <Link
            key={e.id}
            href={`${basePath}/exams/${e.id}`}
            className={`block border rounded-lg p-3 transition-colors ${
              untouched && !published
                ? 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {e.class_name ?? '반 미지정'}
                </span>
                <span className="font-medium text-slate-900">{e.title}</span>
                {e.exam_type && (
                  <span className="text-xs text-slate-500">{e.exam_type}</span>
                )}
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-md ${
                  published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {published ? '공개' : '초안'}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                {e.exam_date} · 만점 {e.max_score}점
              </span>
              <span
                className={
                  done
                    ? 'text-green-600'
                    : untouched
                      ? 'text-slate-400'
                      : 'text-amber-700 font-medium'
                }
              >
                {done
                  ? `입력 완료 ${e.recorded_count}/${e.roster_count}`
                  : untouched
                    ? `미입력 0/${e.roster_count}`
                    : `입력 중 ${e.recorded_count}/${e.roster_count}`}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
