/** 표시용 포맷 헬퍼. 순수 함수, 부수효과 없음. */

/**
 * 한국 휴대폰 번호를 010-1234-5678 형태로 포맷.
 * - 입력은 숫자만 또는 하이픈 포함 가능.
 * - 11자리(010) 또는 10자리(011/016 등 구형) 모두 처리.
 * - 형식 불일치(자리수 다름 등)는 원본 그대로 반환.
 * - null/빈값은 fallback("-") 반환.
 */
export function formatPhoneKR(phone: string | null | undefined, fallback = '-'): string {
  if (!phone) return fallback
  const digits = phone.replace(/\D/g, '')

  if (digits.length === 11) {
    // 010-1234-5678
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    // 02-1234-5678 (서울 지역번호) or 011-123-4567 (구형 이동전화)
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  // 형식이 안 맞으면 원본 (편집 가능하게)
  return phone
}

/**
 * ISO timestamp → "2026. 6. 12. 오후 2:30" 형태의 한국어 일시.
 * 잘못된 입력은 원본 그대로 반환.
 * 서버/클라이언트 어디서 실행돼도 동일 (KST 고정 + 오전/오후 직접 계산).
 *
 * 오전/오후(dayPeriod)는 ICU 빌드에 의존(서버 small-icu는 "PM", 브라우저는 "오후")해
 * hydration mismatch를 일으키므로, hourCycle 'h23'으로 24시간 값을 받아 직접 조립한다.
 */
export function formatDateTimeKR(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  const h24 = Number(get('hour'))
  const period = h24 < 12 ? '오전' : '오후'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${get('year')}. ${get('month')}. ${get('day')}. ${period} ${h12}:${get('minute')}`
}

/**
 * ISO timestamp → "2026. 6. 12." 형태의 한국어 날짜(시각 없음).
 * 잘못된 입력은 원본 그대로 반환. formatDateTimeKR과 같은 이유로
 * new Date(iso).toLocaleDateString('ko-KR')를 직접 쓰지 않는다 — 로케일을 명시해도
 * Node(small-icu)와 브라우저(full-icu)의 ko-KR 렌더링이 달라질 수 있어(구분자,
 * 표기 방식 등) hydration mismatch 소지가 있으므로 formatToParts로 값만 뽑아
 * 직접 조립한다.
 */
export function formatDateKR(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}. ${get('month')}. ${get('day')}.`
}

/** ISO timestamp → "14:00" (KST 고정 — 서버/클라이언트 어디서든 동일). */
export function formatTimeKR(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    // hour12: false는 일부 ICU에서 h24로 매핑되어 자정이 '24:00'이 되는 quirk가 있음
    hourCycle: 'h23',
  })
}
