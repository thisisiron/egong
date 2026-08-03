import { describe, expect, it } from 'vitest'
import { LIGHT, DARK, contrastRatio, hexToOklch } from './palette'

describe('hexToOklch', () => {
  it('흰색과 검정을 OKLCH로 정확히 변환한다', () => {
    expect(hexToOklch('#ffffff')).toBe('oklch(1 0 0)')
    expect(hexToOklch('#000000')).toBe('oklch(0 0 0)')
  })

  it('브랜드색을 알려진 값으로 변환한다', () => {
    expect(hexToOklch('#5b5bd6')).toBe('oklch(0.5403 0.1841 278.3)')
  })
})

describe('대비비 — 본문·보조 텍스트 (AA 4.5:1)', () => {
  const cases: [string, Record<string, string>, string, string][] = [
    ['라이트 본문', LIGHT, 'foreground', 'background'],
    ['라이트 보조', LIGHT, 'mutedForeground', 'background'],
    ['다크 본문', DARK, 'foreground', 'background'],
    ['다크 보조', DARK, 'mutedForeground', 'background'],
  ]
  it.each(cases)('%s', (_label, p, fg, bg) => {
    expect(contrastRatio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('대비비 — 상태 배지 글자 대 배경 (AA 4.5:1)', () => {
  const tones = ['success', 'warning', 'danger', 'neutral'] as const
  it.each(tones)('라이트 %s', (tone) => {
    expect(contrastRatio(LIGHT[`${tone}Foreground`], LIGHT[`${tone}Muted`])).toBeGreaterThanOrEqual(4.5)
  })
  it.each(tones)('다크 %s', (tone) => {
    expect(contrastRatio(DARK[`${tone}Foreground`], DARK[`${tone}Muted`])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('대비비 — 버튼 글자 (AA 4.5:1)', () => {
  it('라이트', () => {
    expect(contrastRatio(LIGHT.primaryForeground, LIGHT.primary)).toBeGreaterThanOrEqual(4.5)
  })
  it('다크', () => {
    expect(contrastRatio(DARK.primaryForeground, DARK.primary)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('대비비 — UI 컴포넌트 경계 (WCAG 1.4.11, 3:1)', () => {
  // --input은 입력 컨트롤을 식별하는 요소라 3:1이 필요하다.
  // --border는 장식용 구분선이라 대상이 아니다(의도적으로 연하다).
  it.each(['input', 'ring'])('라이트 --%s 대 --card', (token) => {
    expect(contrastRatio(LIGHT[token], LIGHT.card)).toBeGreaterThanOrEqual(3)
  })
  it.each(['input', 'ring'])('다크 --%s 대 --card', (token) => {
    expect(contrastRatio(DARK[token], DARK.card)).toBeGreaterThanOrEqual(3)
  })
})

describe('S1 배지 완화책 — 라이트 배지 배경은 충분히 연해야 한다', () => {
  // 스펙 §1.2: 목록에 배지가 20~40개 깔려도 색 덩어리가 되지 않도록 명도 0.955 이상.
  it.each(['success', 'warning', 'danger', 'neutral'])('%s 배경 명도 ≥ 0.955', (tone) => {
    const L = Number(hexToOklch(LIGHT[`${tone}Muted`]).slice(6).split(' ')[0])
    expect(L).toBeGreaterThanOrEqual(0.955)
  })
})

describe('라이트와 다크는 같은 토큰 집합을 정의한다', () => {
  it('키가 일치한다', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort())
  })
})
