/**
 * 디자인 토큰의 단일 소스. app/globals.css의 OKLCH 값은 전부 여기서 유도된다
 * (globals-css.test.ts가 드리프트를 막는다).
 *
 * 값의 근거와 결정 과정은 docs/superpowers/specs/2026-08-04-design-system-overhaul-design.md 참조.
 * 팔레트를 조정하면 palette.test.ts가 접근성 기준 위반을 잡아낸다.
 */

/** sRGB 8bit 채널 → 선형 RGB */
function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`6자리 hex가 아님: ${hex}`)
  return [0, 2, 4].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number]
}

/** 소수점 자리를 맞추고 뒤의 0을 없앤다 (oklch(1 0 0) 같은 짧은 표기를 위해) */
function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.?0+$/, '') || '0'
}

/** hex → CSS oklch() 문자열. Björn Ottosson의 OKLab 변환. */
export function hexToOklch(hex: string): string {
  const [r, g, b] = channels(hex)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

  const C = Math.hypot(A, B)
  let H = (Math.atan2(B, A) * 180) / Math.PI
  if (H < 0) H += 360

  // 무채색은 색상(H)이 의미 없으므로 0으로 고정한다 — 부동소수점 잡음이 드리프트 테스트를 깨지 않게.
  if (C < 0.0005) return `oklch(${trim(L, 4)} 0 0)`
  return `oklch(${trim(L, 4)} ${trim(C, 4)} ${trim(H, 1)})`
}

/** WCAG 2.x 상대 휘도 */
function luminance(hex: string): number {
  const [r, g, b] = channels(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 대비비 (1~21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const LIGHT: Record<string, string> = {
  background: '#fbfbfd',
  foreground: '#16161d',
  card: '#ffffff',
  cardForeground: '#16161d',
  popover: '#ffffff',
  popoverForeground: '#16161d',
  sidebar: '#ffffff',
  sidebarForeground: '#16161d',
  muted: '#f1f1f8',
  mutedForeground: '#6f6f80',
  secondary: '#f1f1f8',
  secondaryForeground: '#16161d',
  accent: '#f1f1f8',
  accentForeground: '#3d3d8f',
  border: '#e7e7ee',
  input: '#94949b',
  primary: '#5b5bd6',
  primaryForeground: '#ffffff',
  ring: '#5b5bd6',

  successForeground: '#1a7a45',
  successMuted: '#e8f6ee',
  warningForeground: '#9a6410',
  warningMuted: '#fdf2e3',
  dangerForeground: '#b02525',
  dangerMuted: '#fdecec',
  neutralForeground: '#666677',
  neutralMuted: '#f1f1f5',

  // shadcn 프리미티브가 기대하는 이름. --danger-foreground와 같은 값의 별칭.
  destructive: '#b02525',
  destructiveForeground: '#ffffff',

  // 차트 — 강조형 원칙(내 점수만 색, 반 평균은 무채색 참조선)
  chartEmphasis: '#5b5bd6',
  chartReference: '#6f6f80',
  chartGrid: '#e7e7ee',

  // 분류(상태 아님) — 달력 점처럼 라벨 없이 종류를 구분해야 하는 곳에만 쓴다
  categoryExam: '#c2410c',
  categoryConsultation: '#0f766e',
}

export const DARK: Record<string, string> = {
  background: '#0d0d12',
  foreground: '#ecedf2',
  card: '#17171f',
  cardForeground: '#ecedf2',
  popover: '#1e1e29',
  popoverForeground: '#ecedf2',
  sidebar: '#0d0d12',
  sidebarForeground: '#ecedf2',
  muted: '#232330',
  mutedForeground: '#8b8b9e',
  secondary: '#232330',
  secondaryForeground: '#ecedf2',
  accent: '#232330',
  accentForeground: '#8b8bf5',
  border: '#26262f',
  input: '#64646d',
  primary: '#8b8bf5',
  primaryForeground: '#0d0d12',
  ring: '#8b8bf5',

  successForeground: '#6ee7a8',
  successMuted: '#12281d',
  warningForeground: '#f0c07a',
  warningMuted: '#2b2113',
  dangerForeground: '#f79a9a',
  dangerMuted: '#2e1717',
  neutralForeground: '#a1a1b0',
  neutralMuted: '#22222c',

  destructive: '#f79a9a',
  destructiveForeground: '#0d0d12',

  chartEmphasis: '#8b8bf5',
  chartReference: '#8b8b9e',
  chartGrid: '#26262f',

  categoryExam: '#fb923c',
  categoryConsultation: '#5eead4',
}

/** 토큰명(camelCase) → CSS 변수명(kebab-case). `successForeground` → `--success-foreground` */
export function cssVarName(token: string): string {
  return `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}
