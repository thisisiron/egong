import { describe, expect, it } from 'vitest'

import { delta, formatDelta, formatMetric } from './types'

describe('delta', () => {
  it('차이를 %p로 준다', () => {
    expect(delta(72, 81)).toBe(-9)
  })

  it('소수 첫째 자리까지 반올림한다', () => {
    expect(delta(72.35, 70)).toBe(2.4)
  })

  it('이번 달 값이 없으면 undefined', () => {
    expect(delta(undefined, 81)).toBeUndefined()
  })

  it('전월 값이 없으면 undefined (신설 반)', () => {
    expect(delta(72, undefined)).toBeUndefined()
  })

  it('변화가 없으면 0', () => {
    expect(delta(80, 80)).toBe(0)
  })
})

describe('formatMetric', () => {
  it('undefined는 데이터 없음(—)이다', () => {
    expect(formatMetric(undefined)).toBe('—')
  })

  it('진짜 0은 0%로 표시한다 — —로 사라지면 안 된다', () => {
    expect(formatMetric(0)).toBe('0%')
  })

  it('일반 값은 반올림해서 %를 붙인다', () => {
    expect(formatMetric(72.6)).toBe('73%')
  })
})

describe('formatDelta', () => {
  it('undefined면 방향 없이 —', () => {
    expect(formatDelta(undefined)).toEqual({ text: '—', tone: 'none' })
  })

  it('0이면 변화 없음 표시, 화살표 없음', () => {
    expect(formatDelta(0)).toEqual({ text: '— 0%p', tone: 'flat' })
  })

  it('양수면 상승 화살표 + 부호(+)', () => {
    expect(formatDelta(5)).toEqual({ text: '▲ +5%p', tone: 'up' })
  })

  it('음수면 하강 화살표 + 부호(-)', () => {
    expect(formatDelta(-9)).toEqual({ text: '▼ -9%p', tone: 'down' })
  })
})
