import path from 'node:path'
import { test as setup, expect } from '@playwright/test'

const PASSWORD = process.env.SEED_PASSWORD ?? '***REMOVED***'

// E2E_BASE_URL이 있으면 배포 환경을 겨눈다는 뜻 — 로컬 dev 서버가 아니므로
// 체크아웃 재사용 가드는 의미가 없다(playwright.config.ts의 USE_LOCAL_SERVER와 동일 조건).
const USE_LOCAL_SERVER = !process.env.E2E_BASE_URL
// next.config.ts가 응답에 실어 보내는 값과 비교할 "이 체크아웃"의 기준 경로.
// next.config.ts의 CHECKOUT_ROOT는 `frontend/`에서 `next dev`를 실행할 때의
// process.cwd() — 즉 frontend 디렉터리 자체다. next.config.ts와 동일하게
// 슬래시로 정규화해서 비교한다(백슬래시는 헤더 왕복 중 유실됨).
const FRONTEND_ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/')

// 역할 → [이메일, 로그인 후 도달해야 하는 URL 패턴]
// 이메일은 backend/scripts/seed/world.py 의 ACCOUNTS와 일치해야 한다.
const ROLES = [
  ['owner', 'owner@egong.test', /\/owner/],
  ['teacher', 'teacher@egong.test', /\/teacher/],
  ['student', 'student@egong.test', /\/me/],
  ['parent', 'parent@egong.test', /\/me/],
] as const

// serial: 체크아웃 가드가 실패하면(다른 워크트리의 dev 서버를 보고 있다는 뜻)
// 이어지는 4개 로그인 테스트는 애초에 성공할 수 없다 — 그대로 두면 각각 30s
// 타임아웃 + 재시도까지 겪은 뒤에야 실패해 원인 파악이 오래 걸린다. serial 모드는
// 앞 테스트가 실패하면 나머지를 곧장 skip 처리해 가드 실패 메시지가 바로 드러나게 한다.
setup.describe.serial('로그인 세션 준비', () => {
  if (USE_LOCAL_SERVER) {
    // reuseExistingServer:true라서 포트 3000에 이미 떠 있는 dev 서버를 그대로 쓴다.
    // 문제는 그 서버가 이 체크아웃(워크트리) 것이 맞느냐다 — 다른 워크트리의 dev
    // 서버가 먼저 포트를 잡고 있으면 이 검사 없이는 엉뚱한 코드를 조용히 검증하게
    // 된다. 실패하면 어느 경로의 서버를 보고 있었는지 그대로 에러에 찍어 원인이
    // 바로 드러나게 한다.
    setup('dev 서버가 이 워크트리의 코드인지 확인', async ({ request, baseURL }) => {
      const res = await request.get(baseURL!)
      const servedRoot = res.headers()['x-egong-checkout-root']
      expect(
        servedRoot,
        `포트 ${new URL(baseURL!).port}의 dev 서버가 이 체크아웃(${FRONTEND_ROOT})이 아니라 ` +
          `'${servedRoot ?? '알 수 없음'}'에서 떠 있습니다. 다른 워크트리의 dev 서버가 이 포트를 ` +
          `먼저 점유하고 있는지 확인하세요 (다른 워크트리 프로세스를 죽이지 말고, 그쪽에서 다른 ` +
          `포트를 쓰게 하거나 이쪽에서 E2E_BASE_URL로 다른 포트를 지정하세요).`
      ).toBe(FRONTEND_ROOT)
    })
  }

  for (const [role, email, urlPattern] of ROLES) {
    setup(`${role} 로그인 세션 저장`, async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('이메일').fill(email)
      await page.getByLabel('비밀번호').fill(PASSWORD)
      await page.getByRole('button', { name: '로그인' }).click()
      await expect(page).toHaveURL(urlPattern)
      await page.context().storageState({ path: `playwright/.auth/${role}.json` })
    })
  }
})
