import { describe, expect, it } from 'vitest'

import { delta } from './types'

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
