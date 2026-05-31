type Props = {
  title: string
  scheduledAt: string
  status: 'present' | 'late' | 'absent' | 'excused' | null
  videoUrl: string | null
}

const STATUS_LABEL: Record<NonNullable<Props['status']>, string> = {
  present: '출석',
  late: '⚠ 지각',
  absent: '❌ 결석',
  // 레거시 excused는 결석으로 통일 표시.
  excused: '❌ 결석',
}

export function SessionVideoItem({ title, scheduledAt, status, videoUrl }: Props) {
  const dateStr = new Date(scheduledAt).toLocaleDateString('ko-KR')
  return (
    <div className="border border-amber-100 rounded-lg p-3 flex items-center gap-3 bg-white">
      <div className="w-14 h-10 bg-slate-800 text-white rounded flex items-center justify-center">
        ▶
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        <div className="text-xs text-slate-500">
          {dateStr} {status ? `· ${STATUS_LABEL[status]}` : ''}
        </div>
      </div>
      {videoUrl ? (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs px-3 py-1.5 bg-amber-400 text-slate-900 hover:bg-amber-500 rounded font-medium"
        >
          보기
        </a>
      ) : (
        <span className="text-xs text-slate-400">영상 없음</span>
      )}
    </div>
  )
}
