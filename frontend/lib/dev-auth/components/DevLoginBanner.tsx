import { isDevLoginEnabled } from '../guard'
import { DEV_ACCOUNTS, DEV_ROLE_ORDER } from '../constants'
import { devLoginAction } from '../actions'

/**
 * dev 전용 퀵 로그인 배너 (임시 기능).
 * 비활성이면 아무것도 렌더하지 않는다 — DOM에 흔적이 남지 않는다.
 */
export function DevLoginBanner() {
  if (!isDevLoginEnabled()) return null

  return (
    <div className="w-full max-w-sm mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900">⚠ DEV 빠른 로그인</p>
      <p className="mt-0.5 text-xs text-amber-700">
        로컬 전용입니다. 로그인 상태에서도 다른 역할을 누르면 계정이 전환됩니다.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEV_ROLE_ORDER.map((role) => (
          <form key={role} action={devLoginAction.bind(null, role)}>
            <button
              type="submit"
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-left transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span className="block text-sm font-medium text-amber-900">
                {DEV_ACCOUNTS[role].label}
              </span>
              <span className="block text-[11px] text-amber-600">
                {DEV_ACCOUNTS[role].email}
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
