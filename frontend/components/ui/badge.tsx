import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * 상태 배지. 색은 의미 4종만 쓴다 — 스펙 §1.2.
 * S1(색 채운 배지)의 위험(목록에서 색 덩어리가 되는 것)을 줄이기 위해
 * 배경은 아주 연하게 유지하고, 배지는 상태 열에만 한 행당 1개까지 쓴다.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        success: "bg-success-muted text-success-foreground",
        warning: "bg-warning-muted text-warning-foreground",
        danger: "bg-danger-muted text-danger-foreground",
        neutral: "bg-neutral-muted text-neutral-foreground",
        outline: "border border-border text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
