import { Badge } from '@/components/ui/badge'
import { EVENT_TYPE_META, type EventType } from '../types'

export function EventBadge({ type }: { type: EventType }) {
  return <Badge variant="neutral">{EVENT_TYPE_META[type].label}</Badge>
}
