'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

const ORDER = ['system', 'light', 'dark'] as const
const META = {
  system: { icon: Monitor, label: '테마: 시스템 설정' },
  light: { icon: Sun, label: '테마: 라이트' },
  dark: { icon: Moon, label: '테마: 다크' },
} as const

const emptySubscribe = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // 서버는 사용자의 테마를 알 수 없다. 마운트 전(서버 스냅샷)에는 중립
  // 자리표시자를 그려 하이드레이션 mismatch를 피한다 (이 저장소는 같은
  // 원인으로 이미 4건을 고쳤다). useSyncExternalStore로 서버 스냅샷은
  // false, 클라이언트 스냅샷은 true를 반환해 setState-in-effect 없이
  // 동일하게 동작시킨다.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  const current = mounted && theme && theme in META ? (theme as keyof typeof META) : 'system'
  const { icon: Icon, label } = META[current]

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {mounted ? <Icon className="h-4 w-4" /> : <span className="block h-4 w-4" />}
    </button>
  )
}
