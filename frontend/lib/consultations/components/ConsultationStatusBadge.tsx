import type { ConsultationStatus } from '../types'
import { STATUS_LABEL } from '../types'

const STYLE: Record<ConsultationStatus, string> = {
  requested: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  rejected: 'border border-slate-200 text-slate-500',
  cancelled: 'border border-slate-200 text-slate-400',
}

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
