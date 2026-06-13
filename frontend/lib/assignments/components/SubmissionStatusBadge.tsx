import type { SubmissionStatus } from '../types'
import { SUBMISSION_STATUS_LABEL } from '../types'

const STYLE: Record<SubmissionStatus, string> = {
  not_submitted: 'border border-slate-200 text-slate-500',
  submitted: 'bg-amber-50 text-amber-700',
  feedback: 'bg-emerald-50 text-emerald-700',
}

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${STYLE[status]}`}>
      {SUBMISSION_STATUS_LABEL[status]}
    </span>
  )
}
