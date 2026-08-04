import { cn } from '@/lib/utils'

type Props = {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

/** 45개 페이지가 각자 작성하던 제목+부제 블록. */
export function PageHeader({ title, subtitle, actions, className }: Props) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-heading text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
