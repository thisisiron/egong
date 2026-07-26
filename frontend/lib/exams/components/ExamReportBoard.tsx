import { ScoreTrendChart } from './ScoreTrendChart'
import { toPercent, TREND_MIN_POINTS, type ExamReportRow } from '../types'

type Props = { rows: ExamReportRow[] }

/**
 * 학생·학부모 리포트. 세 영역이 각각 다른 질문에 답한다 —
 * 요약("지금 몇 점"), 추이("나아지고 있나"), 목록("각 시험이 어땠나").
 * 공개 시험이 TREND_MIN_POINTS 미만이면 추이를 감춘다.
 */
export function ExamReportBoard({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400 bg-white border border-gray-200 rounded-lg p-6 text-center">
        표시할 성적이 없습니다.
      </p>
    )
  }

  const taken = rows.filter((r) => r.my_score !== null && !r.my_is_absent)
  const latest = taken.length > 0 ? taken[taken.length - 1] : null
  const prev = taken.length > 1 ? taken[taken.length - 2] : null

  const latestPct = latest ? toPercent(latest.my_score as number, latest.max_score) : null
  const prevPct = prev ? toPercent(prev.my_score as number, prev.max_score) : null
  const delta = latestPct !== null && prevPct !== null ? Math.round((latestPct - prevPct) * 10) / 10 : null

  return (
    <div className="space-y-3">
      {latest && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              최근 시험
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">
              {latestPct}
              <span className="text-base font-normal text-slate-600">%</span>
            </div>
            {delta !== null && (
              <div className={`mt-1 text-xs ${delta >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%p · 지난 시험 대비
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-slate-500">
              {latest.my_score} / {latest.max_score}점 · {latest.exam_date} · {latest.title}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              반 평균
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-900 tabular-nums">
              {latest.class_avg_pct ?? '—'}
              {latest.class_avg_pct !== null && (
                <span className="text-base font-normal text-slate-600">%</span>
              )}
            </div>
            {latest.class_avg_pct !== null && latestPct !== null && (
              <div className="mt-1 text-xs text-slate-600">
                내 점수가 {Math.abs(Math.round((latestPct - latest.class_avg_pct) * 10) / 10)}%p{' '}
                {latestPct >= latest.class_avg_pct ? '높음' : '낮음'}
              </div>
            )}
            <div className="mt-0.5 text-[11px] text-slate-500">
              반 최고점 {latest.class_max_pct ?? '—'}% · 응시 {latest.taker_count}명
            </div>
          </div>
        </div>
      )}

      {taken.length >= TREND_MIN_POINTS && <ScoreTrendChart rows={rows} />}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-900">
          시험 목록
        </div>
        {[...rows].reverse().map((r) => {
          const pct = r.my_score !== null ? toPercent(r.my_score, r.max_score) : null
          const diff =
            pct !== null && r.class_avg_pct !== null
              ? Math.round((pct - r.class_avg_pct) * 10) / 10
              : null
          return (
            <div key={r.exam_id} className="px-4 py-3 border-b border-slate-100 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-slate-900 truncate">{r.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {r.exam_date}
                    {r.exam_type && ` · ${r.exam_type}`}
                    {r.scope && ` · ${r.scope}`}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  {r.my_is_absent ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                      미응시
                    </span>
                  ) : pct === null ? (
                    <span className="text-[11px] text-slate-400">미입력</span>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {r.my_score} / {r.max_score}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {pct}%
                        {diff !== null && ` · 평균 ${diff >= 0 ? '+' : ''}${diff}%p`}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {pct !== null && !r.my_is_absent && (
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full relative">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%`, background: '#4f46e5' }}
                  />
                  {r.class_avg_pct !== null && (
                    <div
                      className="absolute -top-0.5 -bottom-0.5 w-0.5"
                      style={{ left: `${Math.min(r.class_avg_pct, 100)}%`, background: '#898781' }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
