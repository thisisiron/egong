import Link from 'next/link'

type Props = {
  label: string
  value: string | number
  /** 단위는 숫자와 분리해 작게 붙인다 — '128명'이 아니라 128 + 명 */
  unit?: string
  sub?: string
  href?: string
}

export function StatCard({ label, value, unit, sub, href }: Props) {
  const body = (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors group-hover:border-input">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-heading tabular-nums text-foreground">
          {value}
        </span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )

  if (!href) return body
  return (
    <Link
      href={href}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {body}
    </Link>
  )
}
