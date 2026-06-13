import { SESSION_TYPE_META } from '@/lib/sessions/types'
import { EVENT_TYPE_META } from '@/lib/events/types'

export function ScheduleLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {(['regular', 'makeup', 'special'] as const).map((t) => (
        <Item key={t} dot={SESSION_TYPE_META[t].dot} label={SESSION_TYPE_META[t].label} />
      ))}
      <Item dot="bg-gray-300" label="휴강" strike />
      {(['exam', 'consultation'] as const).map((t) => (
        <Item key={t} dot={EVENT_TYPE_META[t].dot} label={EVENT_TYPE_META[t].label} />
      ))}
      <span>🎬 영상</span>
    </div>
  )
}

function Item({ dot, label, strike }: { dot: string; label: string; strike?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
      <span className={strike ? 'line-through' : ''}>{label}</span>
    </span>
  )
}
