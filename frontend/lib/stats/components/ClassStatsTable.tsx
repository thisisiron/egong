'use client'

/* eslint-disable react-hooks/incompatible-library --
 * TanStack Table의 useReactTable()은 매 렌더마다 새 함수 참조를 반환해 React Compiler가
 * 메모화할 수 없다고 판단한다. 컴포넌트 본문의 'use no memo'로 이미 이 컴포넌트의 메모화를
 * 껐으므로 안전하다 — 이 경고는 그 사실을 알리는 정보성 메시지일 뿐이라 파일 단위로 끈다.
 */

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useState } from 'react'

import { buildColumns } from '../columns'
import { delta, formatDelta, formatMetric, type ClassStatRow, type DeltaTone } from '../types'

type Props = { rows: ClassStatRow[]; basePath: string }

// buildColumns()는 인자가 없는 정적 정의라 렌더마다 새로 만들 이유가 없다.
// 모듈 스코프에서 한 번만 만들어 TanStack Table에 안정된 참조를 넘긴다.
const COLUMNS = buildColumns()

const DELTA_TONE_CLASS: Record<DeltaTone, string> = {
  none: 'text-slate-400',
  flat: 'text-slate-400',
  up: 'text-emerald-600',
  down: 'text-rose-600',
}

/** 지표 셀 — 값 + 전월 대비 델타.
 * 표시 로직(undefined/0 판정, 화살표+부호 조합)은 lib/stats/types.ts의
 * formatMetric/formatDelta에 있다 — 이 컴포넌트는 그 결과를 그리기만 한다.
 */
function MetricCell({ value, prev }: { value?: number; prev?: number }) {
  if (value === undefined) return <span className="text-slate-400">—</span>
  const { text, tone } = formatDelta(delta(value, prev))
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900">{formatMetric(value)}</span>
      <span className={`ml-2 text-xs ${DELTA_TONE_CLASS[tone]}`}>{text}</span>
    </span>
  )
}

export function ClassStatsTable({ rows, basePath }: Props) {
  // TanStack Table의 useReactTable()은 매 렌더마다 새 함수 참조를 반환해
  // React Compiler가 메모화할 수 없다고 판단한다(react-hooks/incompatible-library).
  // 라이브러리 쪽 동작이므로 컴파일러 메모화를 이 컴포넌트에서만 끈다.
  'use no memo'

  // 서버가 이미 출석률 오름차순으로 정렬해 보내므로 하이드레이션 전에도 순서가 맞다.
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'attendancePct', desc: false },
  ])

  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-slate-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sortable = h.column.getCanSort()
                const dir = h.column.getIsSorted()
                return (
                  <th
                    key={h.id}
                    scope="col"
                    aria-sort={
                      !sortable ? undefined : dir === 'asc'
                        ? 'ascending'
                        : dir === 'desc'
                          ? 'descending'
                          : 'none'
                    }
                    className="px-4 py-2.5 text-left font-medium text-slate-600"
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <span aria-hidden className="text-slate-400">
                          {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '↕'}
                        </span>
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const r = row.original
            return (
              <tr key={row.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-2.5">
                  <Link
                    href={`${basePath}/classes/${r.classId}`}
                    className="text-slate-900 hover:underline"
                  >
                    {r.className}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{r.studentCount}</td>
                <td className="px-4 py-2.5">
                  <MetricCell value={r.attendancePct} prev={r.attendancePctPrev} />
                </td>
                <td className="px-4 py-2.5">
                  <MetricCell value={r.submissionPct} prev={r.submissionPctPrev} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
