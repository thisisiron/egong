import { defineConfig } from '@playwright/test'

// 배포 환경을 겨눌 때는 E2E_BASE_URL만 바꾼다 — config는 손대지 않는다.
// 값이 있으면 로컬 dev 서버를 띄우지 않는다.
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const USE_LOCAL_SERVER = !process.env.E2E_BASE_URL

const day = (name: string) => ({
  name: `${name}-day`,
  testMatch: new RegExp(`days/${name}-day\\.spec\\.ts`),
  use: { storageState: `playwright/.auth/${name}.json` },
  dependencies: ['setup'],
})

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  // 4역할이 같은 시드 데이터를 공유하고 쓰기까지 한다. Supabase 연결 한도 문제도 있어
  // 병렬화 이득보다 불안정 비용이 크다.
  workers: 1,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    day('owner'),
    day('teacher'),
    day('student'),
    day('parent'),
    // 기존 스펙 — 이번 범위에서 리팩터하지 않는다. 인자 없는 `playwright test`에서만 돈다.
    { name: 'legacy', testMatch: /e2e\/[^/]+\.spec\.ts$/ },
  ],
  ...(USE_LOCAL_SERVER
    ? {
        webServer: {
          command: 'pnpm dev',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }
    : {}),
})
