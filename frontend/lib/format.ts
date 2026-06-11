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
 */
export function formatDateTimeKR(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
