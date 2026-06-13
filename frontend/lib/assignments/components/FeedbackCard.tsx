type Props = { score: string | null; feedback: string; byName: string | null; at: string | null }

export function FeedbackCard({ score, feedback, byName, at }: Props) {
  const date = at ? `${new Date(at).getMonth() + 1}/${new Date(at).getDate()}` : ''
  return (
    <div className="bg-emerald-50 rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm font-medium text-emerald-800">선생님 피드백</span>
        {score && <span className="ml-auto text-sm font-medium text-emerald-900">점수 {score}</span>}
      </div>
      <p className="text-sm text-emerald-900 whitespace-pre-wrap">{feedback}</p>
      {byName && <p className="text-xs text-emerald-700 mt-2">{byName} · {date}</p>}
    </div>
  )
}
