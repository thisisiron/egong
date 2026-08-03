import path from 'node:path'
import { test as setup, expect } from '@playwright/test'

const PASSWORD = process.env.SEED_PASSWORD ?? '***REMOVED***'

// 체크아웃 재사용 가드는 "E2E_BASE_URL이 설정됐는가"가 아니라 "겨누는 호스트가
// localhost인가"로 판단해야 한다. 이 가드의 실패 메시지가 안내하는 회피책이 바로
// "E2E_BASE_URL로 다른 포트를 지정하라"인데, 그 포트도 결국 로컬 dev 서버(다른
// 워크트리와 충돌 회피용)를 가리킨다 — E2E_BASE_URL의 유무만으로 배포 환경 여부를
// 판단하면, 안내대로 행동한 사람에게서 가드 자체가 꺼져버린다(사고를 막으려던 가드가
// 사고를 겪은 사람 앞에서 무력화). 실제 배포 환경(원격 호스트)을 겨눌 때만 스킵한다.
const TARGET_URL = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000')
const IS_LOCAL_TARGET = ['localhost', '127.0.0.1', '[::1]'].includes(TARGET_URL.hostname)
// next.config.ts가 응답에 실어 보내는 값과 비교할 "이 체크아웃"의 기준 경로.
// next.config.ts의 CHECKOUT_ROOT는 `frontend/`에서 `next dev`를 실행할 때의
// process.cwd() — 즉 frontend 디렉터리 자체다. next.config.ts와 동일하게
// 슬래시로 정규화해서 비교한다(백슬래시는 헤더 왕복 중 유실됨).
const FRONTEND_ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/')
// Windows는 드라이브 문자 대소문자를 구분하지 않는다(`c:\...` === `C:\...`) — 그런데
// process.cwd()가 반환하는 대소문자는 셸/터미널이 그 프로세스를 어떻게 띄웠는지에
// 따라 달라질 수 있어, 실제로는 같은 체크아웃인데도 이 비교가 대소문자 차이만으로
// 거짓 실패(false positive)를 낼 수 있다. win32에서만 소문자로 정규화해서 비교한다
// (다른 OS의 경로는 대소문자 구분이 의미가 있으므로 그대로 둔다).
const normalizeForCompare = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p)

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
  if (IS_LOCAL_TARGET) {
    // reuseExistingServer:true라서 포트 3000(또는 E2E_BASE_URL이 가리키는 로컬 포트)에
    // 이미 떠 있는 dev 서버를 그대로 쓴다. 문제는 그 서버가 이 체크아웃(워크트리) 것이
    // 맞느냐다 — 다른 워크트리의 dev 서버가 먼저 포트를 잡고 있으면 이 검사 없이는
    // 엉뚱한 코드를 조용히 검증하게 된다. 실패하면 어느 경로의 서버를 보고 있었는지
    // 그대로 에러에 찍어 원인이 바로 드러나게 한다.
    setup('dev 서버가 이 워크트리의 코드인지 확인', async ({ request, baseURL }) => {
      const res = await request.get(baseURL!)
      const servedRoot = res.headers()['x-egong-checkout-root']
      const matches =
        servedRoot !== undefined &&
        normalizeForCompare(servedRoot) === normalizeForCompare(FRONTEND_ROOT)
      expect(
        matches,
        `포트 ${new URL(baseURL!).port}의 dev 서버가 이 체크아웃(${FRONTEND_ROOT})이 아니라 ` +
          `'${servedRoot ?? '알 수 없음'}'에서 떠 있습니다. 다른 워크트리의 dev 서버가 이 포트를 ` +
          `먼저 점유하고 있을 가능성이 높습니다. 해결 방법: 1) 다른 워크트리의 프로세스를 죽이지 ` +
          `말고, 이쪽에서 다른 포트로 로컬 dev 서버를 새로 띄우세요 (예: ` +
          `\`PORT=3100 pnpm dev\`). 2) 그 다음 이 포트를 겨누도록 ` +
          `\`E2E_BASE_URL=http://localhost:3100\`을 지정해 테스트를 다시 실행하세요. ` +
          `(E2E_BASE_URL이 localhost/127.0.0.1을 가리키는 한 이 가드는 계속 적용됩니다 — ` +
          `원격 배포 환경을 겨눌 때만 스킵됩니다.)`
      ).toBe(true)
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
