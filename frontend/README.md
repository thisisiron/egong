# Egong Frontend (Next.js)

Next.js 16 App Router 기반 학원 관리 프론트엔드. 패키지명 `@egong/frontend`.

## 개발 명령

```bash
# 루트(monorepo)에서:
pnpm install                    # 워크스페이스 의존성 설치
pnpm dev:frontend               # 개발 서버 (http://localhost:3000)
pnpm build:frontend             # 프로덕션 빌드

# frontend/ 안에서 직접:
pnpm dev                        # next dev
pnpm build                      # next build
pnpm lint                       # eslint
```

## 환경변수

`frontend/.env.local` (gitignored). 템플릿은 `.env.example`.

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 클라우드 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (구 anon key 대체) |
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI 백엔드 URL (개발: `http://localhost:8000`) |

## 디렉토리

```
frontend/
├── app/                  # App Router 페이지 + 레이아웃
│   ├── layout.tsx        # 루트 레이아웃
│   ├── page.tsx          # 홈
│   ├── loading.tsx       # 글로벌 Suspense fallback
│   ├── error.tsx         # 글로벌 error boundary
│   ├── not-found.tsx     # 404
│   ├── global-error.tsx  # 루트 레이아웃 에러
│   └── globals.css       # Tailwind 4 entry
├── components/           # 2+ 라우트에서 재사용되는 컴포넌트
│   └── ui/               # shadcn/ui 컴포넌트 (필요 시 Task 4부터 추가)
├── lib/
│   ├── supabase/         # Supabase client/server/types (Task 2·4에서 작성)
│   ├── api/              # FastAPI 호출 wrapper (Task 5 이후)
│   ├── hooks/            # 공통 React hooks
│   └── utils.ts          # cn() helper
├── components.json       # shadcn 설정
└── ...
```

라우트-로컬 컴포넌트는 각 라우트 segment의 `_components/` (private folder)에 colocate.

## shadcn/ui 추가법

이 프로젝트는 Node 24 + zod ESM 호환 문제로 `pnpm dlx shadcn` CLI가 실패합니다. 컴포넌트는 https://ui.shadcn.com/docs/components/<name> 에서 소스를 복사해 `components/ui/<name>.tsx`로 직접 붙여넣으세요. peer deps(`clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tailwindcss-animate`)는 이미 설치됨.
