import { describe, expect, it } from 'vitest'

import {
  isCurrentMonthKST,
  kstParts,
  monthFromParam,
  monthParam,
  monthRange,
  nextMonth,
  prevMonth,
  todayRangeKST,
  ymdKST,
} from './date'

// 이 파일은 date-fns 이전(plan Task 2) 전에 현재 동작을 고정하는 특성화 테스트다.
// 구현을 갈아끼운 뒤에도 그대로 통과해야 한다 — 66개 호출지의 안전망.

describe('kstParts', () => {
  it('UTC 자정을 KST 오전 9시로 읽는다', () => {
    expect(kstParts(new Date('2026-08-02T00:00:00Z'))).toEqual({
      year: 2026,
      month: 8,
      day: 2,
    })
  })

  it('UTC 15:00 이후는 KST 기준 다음 날이다', () => {
    expect(kstParts(new Date('2026-07-31T15:30:00Z'))).toEqual({
      year: 2026,
      month: 8,
      day: 1,
    })
  })

  it('UTC 14:59는 아직 KST 같은 날이다', () => {
    expect(kstParts(new Date('2026-07-31T14:59:00Z'))).toEqual({
      year: 2026,
      month: 7,
      day: 31,
    })
  })
})

describe('ymdKST', () => {
  it('한 자리 월·일을 0으로 채운다', () => {
    expect(ymdKST(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05')
  })

  it('UTC 15:00 이후는 KST 다음 날로 넘어간다', () => {
    expect(ymdKST(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01')
  })
})

describe('monthRange', () => {
  it('31일 달의 말일을 정확히 준다', () => {
    const r = monthRange(new Date('2026-08-15T00:00:00Z'))
    expect(r.from).toBe('2026-08-01')
    expect(r.to).toBe('2026-08-31')
    expect(r.label).toBe('2026년 8월')
  })

  it('2월 윤년 말일을 정확히 준다', () => {
    expect(monthRange(new Date('2028-02-10T00:00:00Z')).to).toBe('2028-02-29')
  })

  it('2월 평년 말일을 정확히 준다', () => {
    expect(monthRange(new Date('2026-02-10T00:00:00Z')).to).toBe('2026-02-28')
  })

  it('fromIso는 KST 1일 00:00을 UTC로 환산한 값이다', () => {
    // KST 2026-08-01 00:00 = UTC 2026-07-31 15:00
    expect(monthRange(new Date('2026-08-15T00:00:00Z')).fromIso).toBe(
      '2026-07-31T15:00:00.000Z'
    )
  })

  it('toIso는 다음 달 1일 KST 00:00이다 (반개구간)', () => {
    expect(monthRange(new Date('2026-08-15T00:00:00Z')).toIso).toBe(
      '2026-08-31T15:00:00.000Z'
    )
  })

  it('12월의 toIso는 다음 해 1월로 넘어간다', () => {
    expect(monthRange(new Date('2026-12-10T00:00:00Z')).toIso).toBe(
      '2026-12-31T15:00:00.000Z'
    )
  })
})

describe('todayRangeKST', () => {
  it('KST 오늘의 [00:00, 24:00) UTC 범위를 준다', () => {
    const r = todayRangeKST(new Date('2026-08-02T03:00:00Z'))
    expect(r.fromIso).toBe('2026-08-01T15:00:00.000Z')
    expect(r.toIso).toBe('2026-08-02T15:00:00.000Z')
  })
})

describe('monthFromParam', () => {
  const now = new Date('2026-08-15T00:00:00Z')

  it('정상 YYYY-MM을 그 달 KST 1일로 읽는다', () => {
    expect(kstParts(monthFromParam('2026-03', now))).toMatchObject({
      year: 2026,
      month: 3,
      day: 1,
    })
  })

  it('형식이 틀리면 이번 달로 폴백한다', () => {
    expect(kstParts(monthFromParam('abc', now))).toMatchObject({
      year: 2026,
      month: 8,
    })
  })

  it('범위 밖 월이면 이번 달로 폴백한다', () => {
    expect(kstParts(monthFromParam('2026-13', now))).toMatchObject({
      year: 2026,
      month: 8,
    })
  })

  it('파라미터가 없으면 이번 달로 폴백한다', () => {
    expect(kstParts(monthFromParam(undefined, now))).toMatchObject({
      year: 2026,
      month: 8,
    })
  })
})

describe('prevMonth / nextMonth', () => {
  // monthFromParam은 미래 달을 clamp하므로, 각 대상 달 자신을 now로 넘겨
  // 실행 시점의 실제 시스템 시각과 무관하게 결정적으로 만든다.
  const aug = monthFromParam('2026-08', new Date('2026-08-15T00:00:00Z'))

  it('이전 달로 간다', () => {
    expect(kstParts(prevMonth(aug))).toMatchObject({ year: 2026, month: 7, day: 1 })
  })

  it('다음 달로 간다', () => {
    expect(kstParts(nextMonth(aug))).toMatchObject({ year: 2026, month: 9, day: 1 })
  })

  it('1월의 이전 달은 작년 12월이다', () => {
    const jan = monthFromParam('2026-01', new Date('2026-01-15T00:00:00Z'))
    expect(kstParts(prevMonth(jan))).toMatchObject({ year: 2025, month: 12, day: 1 })
  })

  it('12월의 다음 달은 내년 1월이다', () => {
    const dec = monthFromParam('2026-12', new Date('2026-12-15T00:00:00Z'))
    expect(kstParts(nextMonth(dec))).toMatchObject({ year: 2027, month: 1, day: 1 })
  })

  it('31일 달에서 이전 달로 가도 1일에 고정된다', () => {
    // 3월 31일에서 subMonths하면 2월 31일이 없어 말일로 밀리는 함정 — 1일 기준이라 안전
    const mar = monthFromParam('2026-03', new Date('2026-03-15T00:00:00Z'))
    expect(kstParts(prevMonth(mar))).toMatchObject({ year: 2026, month: 2, day: 1 })
  })
})

describe('isCurrentMonthKST', () => {
  const now = new Date('2026-08-15T00:00:00Z')

  it('같은 달이면 true', () => {
    expect(isCurrentMonthKST(monthFromParam('2026-08', now), now)).toBe(true)
  })

  it('지난 달이면 false', () => {
    expect(isCurrentMonthKST(monthFromParam('2026-07', now), now)).toBe(false)
  })

  it('KST 자정 직후 UTC는 전월이어도 KST 기준으로 판정한다', () => {
    // UTC 2026-07-31 15:30 = KST 2026-08-01 00:30
    const kstJustAfterMidnight = new Date('2026-07-31T15:30:00Z')
    expect(
      isCurrentMonthKST(monthFromParam('2026-08', kstJustAfterMidnight), kstJustAfterMidnight)
    ).toBe(true)
  })
})

describe('monthParam', () => {
  it("URL 쿼리용 'YYYY-MM'을 준다", () => {
    expect(monthParam(monthFromParam('2026-03', new Date('2026-03-15T00:00:00Z')))).toBe(
      '2026-03'
    )
  })

  it('한 자리 월을 0으로 채운다', () => {
    expect(monthParam(monthFromParam('2026-09', new Date('2026-09-15T00:00:00Z')))).toBe(
      '2026-09'
    )
  })
})

describe('monthFromParam 미래 클램프', () => {
  const now = new Date('2026-08-15T00:00:00Z')

  it('미래 달을 요청하면 이번 달로 클램프한다', () => {
    expect(kstParts(monthFromParam('2026-12', now))).toMatchObject({
      year: 2026,
      month: 8,
    })
  })

  it('과거 달은 클램프하지 않는다', () => {
    expect(kstParts(monthFromParam('2020-01', now))).toMatchObject({
      year: 2020,
      month: 1,
    })
  })

  it('이번 달 자신은 통과한다', () => {
    expect(kstParts(monthFromParam('2026-08', now))).toMatchObject({
      year: 2026,
      month: 8,
    })
  })
})
