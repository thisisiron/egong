# Egong — 학원 관리 ERP + 학습관리 MVP

일도수학 첫 사례. 컨설팅/에이전시 모델.

## 개발 환경

### 사전 조건
- Node.js 20+ (현재 검증: 24.x)
- pnpm 9+ (현재: 11.3.0)
- Python 3.11+ (Windows: `C:/Users/ldcc/AppData/Local/Programs/Python/Python312/python.exe`)
- Supabase 클라우드 프로젝트 1개 (대시보드에서 생성, 키 복사)

### 시작

```bash
# 1. 의존성
pnpm install                                                # 워크스페이스 전체
cd backend
"C:/Users/ldcc/AppData/Local/Programs/Python/Python312/python.exe" -m venv .venv
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

# 3. (선택) Supabase CLI 로그인·링크 — Task 2 마이그레이션 push 직전에
npx supabase login                                          # 브라우저 OAuth
npx supabase link --project-ref ltyopuvdqtcajioioudb
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
| `pnpm dev:frontend` | Next.js dev server |
| `pnpm dev:backend` | FastAPI (uvicorn, port 8000) |
| `pnpm build:frontend` | Next.js production 빌드 |
| `pnpm test:frontend` | 프론트엔드 테스트 |
| `pnpm test:backend` | pytest (`cd backend && pytest`) |
| `pnpm db:push` | Supabase 마이그레이션 push |
| `pnpm db:types` | DB 타입 자동 생성 → `frontend/lib/supabase/database.types.ts` (셸에 `SUPABASE_PROJECT_REF` 필요) |

자세한 셋업은 `frontend/README.md`, `backend/README.md` 참조.
