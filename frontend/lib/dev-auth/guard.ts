import 'server-only'

/**
 * dev 퀵 로그인 활성 여부 — 이 프로젝트에서 유일한 판정 지점.
 *
 * 배너와 서버 액션 **양쪽에서** 호출해야 한다. 서버 액션은 모듈이 import되는
 * 순간 등록되어 URL로 직접 호출될 수 있으므로, 버튼을 렌더하지 않는 것만으로는
 * 막히지 않는다.
 *
 * DEV_LOGIN_ENABLED 에 NEXT_PUBLIC_ 접두사를 붙이지 말 것 —
 * 서버 전용이어야 클라이언트 번들에 실리지 않는다.
 */
export function isDevLoginEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.DEV_LOGIN_ENABLED === '1'
}
