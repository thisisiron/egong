import { describe, expect, it } from 'vitest'
import {
  APPLICATION_TONE,
  ATTENDANCE_TONE,
  CONSULTATION_TONE,
  SUBMISSION_TONE,
  type Tone,
} from './status'

const TONES: Tone[] = ['success', 'warning', 'danger', 'neutral']

describe('모든 도메인 상태가 의미 4종 중 하나로 매핑된다', () => {
  const maps = {
    출결: ATTENDANCE_TONE,
    과제제출: SUBMISSION_TONE,
    상담: CONSULTATION_TONE,
    가입신청: APPLICATION_TONE,
  }
  for (const [name, map] of Object.entries(maps)) {
    it(`${name}`, () => {
      for (const tone of Object.values(map)) expect(TONES).toContain(tone)
    })
  }
})

describe('의미 매핑이 스펙 §1.2와 일치한다', () => {
  it('정상 완료는 success', () => {
    expect(ATTENDANCE_TONE.present).toBe('success')
    expect(SUBMISSION_TONE.feedback).toBe('success')
    expect(CONSULTATION_TONE.confirmed).toBe('success')
    expect(APPLICATION_TONE.approved).toBe('success')
  })

  it('주의·대기는 warning', () => {
    expect(ATTENDANCE_TONE.late).toBe('warning')
    expect(SUBMISSION_TONE.submitted).toBe('warning')
    expect(CONSULTATION_TONE.requested).toBe('warning')
    expect(APPLICATION_TONE.pending).toBe('warning')
  })

  it('실패·거절은 danger', () => {
    expect(ATTENDANCE_TONE.absent).toBe('danger')
    expect(SUBMISSION_TONE.not_submitted).toBe('danger')
    expect(CONSULTATION_TONE.rejected).toBe('danger')
    expect(APPLICATION_TONE.rejected).toBe('danger')
  })

  it('해당없음·미확정은 neutral', () => {
    expect(ATTENDANCE_TONE.excused).toBe('neutral')
    expect(CONSULTATION_TONE.cancelled).toBe('neutral')
  })
})

describe('출결 상태를 빠짐없이 덮는다', () => {
  it('4종 전부', () => {
    expect(Object.keys(ATTENDANCE_TONE).sort()).toEqual(['absent', 'excused', 'late', 'present'])
  })
})
