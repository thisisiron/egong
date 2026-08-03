# Egong — 학원 관리 ERP + 학습관리 MVP

일도수학 첫 사례. 컨설팅/에이전시 모델.

## 개발 환경

### 사전 조건
- Node.js 20+ (현재 검증: 24.x)
- pnpm 9+ (현재: 11.3.0)
- Python 3.11+ (경로는 머신마다 다르다 — `python3 --version` 또는 `py --version`으로
  확인하고, 아래 venv 생성 단계에서 그 인터프리터를 사용할 것. 예: `python`, `python3`,
  `py -3.12`, 또는 `uv`로 관리 중이면 `uv python find`)
- Supabase 클라우드 프로젝트 1개 (대시보드에서 생성, 키 복사)

### 시작

```bash
# 1. 의존성
pnpm install                                                # 워크스페이스 전체
cd backend
python -m venv .venv                                        # 위에서 확인한 인터프리터로 실행
source .venv/Scripts/activate                               # Git Bash
pip install -e ".[dev]"
cd ..

# 2. 환경변수 — 루트 .env가 유일한 소스. backend/.env, frontend/.env.local은 손으로 만들지 않는다
cp .env.example .env
# Supabase 대시보드에서 URL·publishable·secret 키·project ref, 그리고 NTS_API_KEY(data.go.kr)를
# 복사해 루트 .env 하나에 입력 (자세한 항목·출처는 .env.example 주석 참고)
pnpm env:sync                                                # backend/.env, frontend/.env.local 생성
# 이미 있는 backend/.env, frontend/.env.local을 덮어써도 되면 --force 필요:
#   pnpm env:sync -- --force
#
# SUPABASE_PROJECT_REF는 앱 코드가 아니라 db:types 스크립트 전용이라 env:sync가 복사하지
# 않는다 — pnpm db:types 실행 전에는 셸 환경에 직접 있어야 함:
#   export SUPABASE_PROJECT_REF=<your-ref>     # Git Bash
# 또는 dotenv-cli로 .env를 로드하는 방식 사용
#
# backend/.env 에 SEED_PASSWORD=<강한 비밀번호>도 추가할 것 — 시드 스크립트
# (scripts/seed_dev_accounts.py)가 하드코딩 기본값 없이 이 환경변수를 필수로 요구한다.
# dev 퀵 로그인을 쓴다면 frontend/.env.local 의 DEV_LOGIN_PASSWORD를 같은 값으로 맞출 것.

# 3. (선택) Supabase CLI 로그인·링크 — Task 2 마이그레이션 push 직전에
npx supabase login                                          # 브라우저 OAuth
npx supabase link --project-ref <your-project-ref>          # 대시보드 → Settings → General 에서 확인
pnpm run db:push                                            # 마이그레이션 push (Task 2 이후)
pnpm run db:types                                           # TypeScript 타입 생성

# 4. FastAPI (별 터미널)
pnpm run dev:backend                                        # http://localhost:8000

# 5. Next.js (또 별 터미널)
pnpm run dev:frontend                                       # http://localhost:3000
```

- 웹: http://localhost:3000
- API: http://localhost:8000/docs (Swagger UI)

> **dev 서버는 루프백(`127.0.0.1`)에만 바인딩됩니다.** 같은 네트워크의 다른 기기에서는 접속되지 않습니다.
> 휴대폰 실기기로 확인해야 할 때만 `pnpm --filter @egong/frontend exec next dev`처럼 `-H` 없이 띄우세요.
> 단, 그 상태에서는 dev 전용 퀵 로그인 배너(`DEV_LOGIN_ENABLED=1`)도 함께 노출되므로 신뢰할 수 있는 네트워크에서만 하세요.
- Supabase: https://supabase.com/dashboard → egong 프로젝트 → SQL Editor / Table Editor

### 디렉토리

| 경로 | 설명 |
|---|---|
| `frontend/` | Next.js 16 App Router 프론트엔드 (`@egong/frontend`) |
| `backend/` | FastAPI 백엔드 (도메인-드리븐, `src/<domain>/`) |
| `supabase/migrations/` | DB 스키마 마이그레이션 (Task 2부터) |
| `docs/superpowers/specs/` | 디자인 문서 |
| `docs/superpowers/plans/` | 11개 Task 구현 계획 |

### 스크립트 (루트 `package.json`)

| 명령 | 동작 |
|---|---|
| `pnpm env:sync` | 루트 `.env` → `backend/.env`, `frontend/.env.local` 생성 (`scripts/env-sync.mjs`) |
| `pnpm dev:frontend` | Next.js dev server |
| `pnpm dev:backend` | FastAPI (uvicorn, port 8000) |
| `pnpm build:frontend` | Next.js production 빌드 |
| `pnpm test:frontend` | 프론트엔드 e2e (Playwright) — 아래 참고 |
| `pnpm test:unit` | 프론트엔드 단위 테스트 (Vitest) |
| `pnpm test:backend` | pytest (`cd backend && pytest`) |
| `pnpm db:push` | Supabase 마이그레이션 push |
| `pnpm db:types` | DB 타입 자동 생성 → `frontend/lib/supabase/database.types.ts` (셸에 `SUPABASE_PROJECT_REF` 필요) |
| `pnpm seed:reset` | 개발용 시드 데이터 초기화 (`backend/scripts/seed_dev_accounts.py --reset`) |
| `pnpm test:rls` | RLS 정책 pytest (`-m rls`) |
| `pnpm test:scenario` | `seed:reset` 실행 후 4역할 day E2E 시나리오 |

> `seed:reset` / `test:rls`는 `backend/.venv/Scripts/python.exe`(Windows venv 경로)를 직접 호출합니다.
> 이 팀은 Windows에서 개발하므로 하드코딩돼 있습니다 — macOS/Linux에서 돌리려면
> `.venv/bin/python`으로 바꿔야 합니다. PowerShell·cmd.exe·Git Bash 어디서 `pnpm run`으로
> 실행해도 동작하도록 경로에 `./` 접두사를 쓰지 않습니다(cmd.exe는 `./x`를 실행 파일로
> 인식하지 못해 `'.' is not recognized...` 오류가 났었습니다).

#### `pnpm test:frontend` (Playwright e2e) 실행 전 필수

`frontend/playwright.config.ts`는 dotenv를 로드하지 않는다. `frontend/e2e/auth.setup.ts`와
`frontend/e2e/stats.spec.ts`는 `SEED_PASSWORD`가 없으면 **모듈 로드 시점에 throw**하므로,
셸 환경변수로 미리 내보내지 않으면 테스트가 시작도 못 하고 죽는다(하네스가 고장난 것처럼
보이지만 실제로는 이 변수 부재가 원인):

```bash
export SEED_PASSWORD=<seed_dev_accounts.py에 쓴 것과 같은 값>   # Git Bash
pnpm test:frontend
```

자세한 셋업은 `frontend/README.md`, `backend/README.md` 참조.
