import { EVENT_TYPE_META, type EventType } from '../types'

export function EventBadge({ type }: { type: EventType }) {
  const m = EVENT_TYPE_META[type]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.badge}`}>{m.label}</span>
  )
}
