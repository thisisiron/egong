type Props = {
  message: string
  action?: React.ReactNode
}

/** "…을 불러오지 못했습니다" / "아직 없습니다" 문구가 곳곳에 흩어져 있던 것을 모은다. */
export function EmptyState({ message, action }: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}
