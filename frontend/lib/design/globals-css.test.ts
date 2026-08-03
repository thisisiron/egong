import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DARK, LIGHT, cssVarName, hexToOklch } from './palette'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

/** `:root { ... }` 또는 `.dark { ... }` 블록 안의 `--이름: 값;`을 뽑는다 */
function block(selector: string): Record<string, string> {
  const re = new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 'm')
  const found = css.match(re)
  if (!found) throw new Error(`${selector} 블록을 찾지 못했다`)
  const out: Record<string, string> = {}
  for (const line of found[1].split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

describe('globals.css가 palette.ts와 어긋나지 않는다', () => {
  const root = block(':root')
  const dark = block('\\.dark')

  it.each(Object.keys(LIGHT))('라이트 --%s', (token) => {
    expect(root[cssVarName(token)]).toBe(hexToOklch(LIGHT[token]))
  })

  it.each(Object.keys(DARK))('다크 --%s', (token) => {
    expect(dark[cssVarName(token)]).toBe(hexToOklch(DARK[token]))
  })
})

describe('@theme inline이 전 토큰을 노출한다', () => {
  // 이 검사가 이번 작업의 핵심이다. 노출되지 않은 토큰은 유틸리티가 생기지 않아
  // 화면 코드가 다시 원시 팔레트로 돌아가게 된다.
  const theme = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/)
  it('블록이 존재한다', () => expect(theme).not.toBeNull())

  it.each(Object.keys(LIGHT))('--color-%s 매핑이 있다', (token) => {
    const name = cssVarName(token).slice(2) // 앞의 '--' 제거
    expect(theme![1]).toContain(`--color-${name}: var(--${name});`)
  })
})

describe('폰트 적용을 막던 코드가 사라졌다', () => {
  it('body에 Arial 폴백이 없다', () => {
    expect(css).not.toMatch(/font-family:\s*Arial/i)
  })
  it('Geist 변수 참조가 없다', () => {
    expect(css).not.toContain('--font-geist')
  })
})

describe('반경 스케일이 --radius 하나에서 파생된다', () => {
  it.each([
    ['--radius-sm', 'calc(var(--radius) * 0.6)'],
    ['--radius-md', 'calc(var(--radius) * 0.8)'],
    ['--radius-lg', 'var(--radius)'],
    ['--radius-xl', 'calc(var(--radius) * 1.4)'],
  ])('%s', (name, value) => {
    expect(css).toContain(`${name}: ${value};`)
  })
})
