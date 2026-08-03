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
  // 콜드 상태(Turbopack dev 서버가 라우트를 아직 컴파일하지 않은 시점)에서 로그인
  // 서버 액션 + 목적지 페이지 컴파일이 겹치면 기본 5s로 부족함이 실측으로 확인됨
  // (최초 실행 시 owner/teacher/student 3개가 5s 초과로 실패, 웜업된 마지막 role만 통과).
  // 완전 콜드 서버 재측정: owner(최초 요청, 최악 케이스) 테스트 전체 19.7s, 이후
  // teacher 6.8s → student 6.0s → parent 4.9s로 감소. 15s면 최초 요청도 재시도 없이
  // 통과하는 것을 확인(task-9-report.md 참고) — 여유를 두어 15s로 상향.
  expect: {
    timeout: 15_000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      // setup은 제품 동작이 아니라 로그인 세션을 확보하는 인프라다 — dev 서버의
      // 콜드 컴파일 지연을 흡수하기 위해 재시도 1회를 허용한다.
      // day 스펙(owner-day 등)은 제품 동작을 검증하므로 재시도를 절대 두지 않는다
      // (전역 기본값 0 유지) — 재시도는 실제 간헐적 버그를 숨길 수 있기 때문이다.
      retries: 1,
    },
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
          // 이 저장소는 .claude/worktrees/ 아래 여러 워크트리에서 병렬로 개발한다.
          // reuseExistingServer:true는 "포트 3000에 뭔가 떠 있으면 그게 뭐든 재사용"
          // 한다는 뜻이라, 다른 워크트리(다른 브랜치)의 dev 서버가 먼저 3000을
          // 잡고 있으면 이 체크아웃과 무관한 코드를 검증하고도 조용히 통과해
          // 버린다(실제로 겪음 — 새 라우트가 없는 브랜치의 서버를 재사용해 그
          // 라우트만 404, 나머지는 통과). 그렇다고 무조건 reuseExistingServer:false로
          // 바꾸면 되는 게 아니다: Next는 포트가 점유돼 있으면 기본적으로 조용히
          // 다음 포트(3001...)로 밀려나고, 그러면 BASE_URL(3000 고정)과 실제
          // 서버 포트가 어긋나 더 알아채기 어려운 실패가 된다(직접 재현 확인).
          // 그래서 두 가지를 함께 한다:
          //   1) PORT를 BASE_URL 포트로 고정 — 포트가 점유돼 있으면 Next가 밀려나지
          //      않고 EADDRINUSE로 즉시, 시끄럽게 죽는다(직접 확인).
          //   2) reuseExistingServer는 true로 유지(같은 워크트리에서 이미 띄워둔
          //      dev 서버를 재사용하는 흔한 워크플로를 그대로 지원) 하되, "재사용된
          //      서버가 이 체크아웃의 코드가 맞는지"는 e2e/auth.setup.ts의 첫 테스트가
          //      x-egong-checkout-root 응답 헤더(next.config.ts에서 설정)로 검증한다.
          //      다르면 어떤 경로의 서버를 보고 있는지까지 에러 메시지에 그대로 찍혀
          //      원인이 즉시 드러난다.
          reuseExistingServer: true,
          env: { PORT: new URL(BASE_URL).port || '3000' },
          timeout: 60_000,
        },
      }
    : {}),
})
