import { Badge } from '@/components/ui/badge'
import { SUBMISSION_TONE } from '@/lib/design/status'
import type { SubmissionStatus } from '../types'
import { SUBMISSION_STATUS_LABEL } from '../types'

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant={SUBMISSION_TONE[status]}>{SUBMISSION_STATUS_LABEL[status]}</Badge>
}
