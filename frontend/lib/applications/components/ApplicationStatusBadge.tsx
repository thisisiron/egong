import type { ApplicationStatus } from '../types'

const STATUS_LABEL: Record<ApplicationStatus, { label: string; cls: string }> = {
  pending: { label: '검토 대기', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: '승인됨', cls: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: '거절됨', cls: 'bg-red-100 text-red-800 border-red-200' },
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_LABEL[status]
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${meta.cls}`}
    >
      {meta.label}
    </span>
  )
}
