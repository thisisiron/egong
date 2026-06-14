import Link from 'next/link'
import type { QuestionWithClass } from '../types'

/** owner/teacher/me 공용 질문 목록. basePath로 링크 분기. unresolvedOnly면 미해결만. */
export function QuestionList({
  questions,
  basePath,
  unresolvedOnly = false,
}: {
  questions: QuestionWithClass[]
  basePath: string
  unresolvedOnly?: boolean
}) {
  const items = unresolvedOnly ? questions.filter((q) => !q.is_resolved) : questions
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">질문이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((q) => (
        <Link key={q.id} href={`${basePath}/${q.id}`}
              className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{q.class_name}</span>
            <span className="font-medium">{q.title}</span>
            <span className="ml-auto flex items-center gap-1">
              {q.is_public
                ? <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">공개</span>
                : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">비공개</span>}
              {q.is_resolved
                ? <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">해결됨</span>
                : <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">미해결</span>}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {q.author_name} · {new Date(q.created_at).toLocaleString('ko-KR')}
          </p>
        </Link>
      ))}
    </div>
  )
}
