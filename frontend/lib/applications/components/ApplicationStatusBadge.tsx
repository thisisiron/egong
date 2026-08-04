import { Badge } from '@/components/ui/badge'
import { APPLICATION_TONE } from '@/lib/design/status'
import type { ApplicationStatus } from '../types'

const LABEL: Record<ApplicationStatus, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '거절됨',
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={APPLICATION_TONE[status]}>{LABEL[status]}</Badge>
}
