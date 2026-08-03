'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/** next-themes는 클라이언트 컴포넌트다. RSC인 layout.tsx에서 쓰려면 경계가 필요하다. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
