import { toPercent, type ExamReportRow } from '../types'

type Props = { rows: ExamReportRow[] }

const W = 520
const H = 190
const X0 = 40
const X1 = 500
const Y_TOP = 20
const Y_BASE = 160

const MINE = '#4f46e5'
const AVG = '#898781'

function y(pct: number): number {
  return Y_BASE - (pct / 100) * (Y_BASE - Y_TOP)
}

function x(i: number, n: number): number {
  if (n === 1) return (X0 + X1) / 2
  return X0 + 15 + ((X1 - X0 - 30) / (n - 1)) * i
}

/**
 * 백분율 추이. 강조(emphasis) 형태 — 내 점수만 색을 쓰고 반 평균은 무채색 참조선이라
 * 서열을 만들지 않으면서 맥락만 준다. 반 평균이 무채색이므로 범례가 정체성을 보완한다.
 * 만점이 시험마다 다르므로 축은 백분율 하나만 쓴다(원점수 이중축 금지).
 */
export function ScoreTrendChart({ rows }: Props) {
  const points = rows
    .filter((r) => r.my_score !== null && !r.my_is_absent)
    .map((r) => ({
      label: r.exam_date.slice(5).replace('-', '/'),
      title: r.title,
      mine: toPercent(r.my_score as number, r.max_score),
      avg: r.class_avg_pct,
    }))

  if (points.length === 0) return null
  const n = points.length

  const minePath = points.map((p, i) => `${x(i, n)},${y(p.mine)}`).join(' ')
  const avgPoints = points
    .map((p, i) => (p.avg === null ? null : `${x(i, n)},${y(p.avg)}`))
    .filter((s): s is string => s !== null)
    .join(' ')
  const last = points[n - 1]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <span className="text-sm font-semibold text-slate-900">백분율 추이</span>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-0.5" style={{ background: MINE }} />내 점수
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-0.5" style={{ background: AVG }} />반 평균
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`시험별 백분율 추이. ${points[0].label} ${points[0].mine}%에서 ${last.label} ${last.mine}%.`}
      >
        <g stroke="#e2e8f0" strokeWidth="1">
          {[100, 75, 50, 25].map((v) => (
            <line key={v} x1={X0} y1={y(v)} x2={X1} y2={y(v)} />
          ))}
        </g>
        <line x1={X0} y1={Y_BASE} x2={X1} y2={Y_BASE} stroke="#c3c2b7" strokeWidth="1" />

        <g fill="#898781" fontSize="10" textAnchor="end">
          {[100, 75, 50, 25, 0].map((v) => (
            <text key={v} x={X0 - 7} y={y(v) + 3}>
              {v}
            </text>
          ))}
        </g>

        {avgPoints && (
          <polyline
            fill="none"
            stroke={AVG}
            strokeWidth="2"
            strokeDasharray="5 4"
            points={avgPoints}
          />
        )}
        <polyline fill="none" stroke={MINE} strokeWidth="2" points={minePath} />

        <g fill={MINE} stroke="#ffffff" strokeWidth="2">
          {points.map((p, i) => (
            <circle key={i} cx={x(i, n)} cy={y(p.mine)} r={i === n - 1 ? 5 : 4} />
          ))}
        </g>

        <text
          x={x(n - 1, n)}
          y={y(last.mine) - 10}
          fill="#0f172a"
          fontSize="11"
          fontWeight="600"
          textAnchor="end"
        >
          {last.mine}%
        </text>

        <g fill="#898781" fontSize="10" textAnchor="middle">
          {points.map((p, i) => (
            <text key={i} x={x(i, n)} y={H - 15}>
              {p.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  )
}
