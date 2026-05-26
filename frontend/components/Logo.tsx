import Link from 'next/link'

type Props = {
  href?: string
  /** 학원명 표시 (옵션) */
  subtitle?: string
}

export function Logo({ href = '/', subtitle }: Props) {
  return (
    <Link href={href} className="flex items-center gap-2 group">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-base shadow-sm transition group-hover:bg-amber-500">
        🥚
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-bold text-slate-900 tracking-tight">Egong</span>
        {subtitle && (
          <span className="text-xs text-slate-500 hidden sm:inline">{subtitle}</span>
        )}
      </span>
    </Link>
  )
}
