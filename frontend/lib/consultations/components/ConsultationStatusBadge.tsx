import { Badge } from '@/components/ui/badge'
import { CONSULTATION_TONE } from '@/lib/design/status'
import type { ConsultationStatus } from '../types'
import { STATUS_LABEL } from '../types'

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
  return <Badge variant={CONSULTATION_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}
