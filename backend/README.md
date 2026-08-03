# Egong Backend (FastAPI)

도메인-드리븐 FastAPI 백엔드. 모든 admin·연동·외부 API 호출은 여기를 거침.

## 셋업

[uv](https://docs.astral.sh/uv/)만 있으면 된다. Python 자체도 uv가 받아오므로,
머신에 어떤 Python이 깔려 있는지(또는 `python`이 Microsoft Store stub인지) 상관없다.

```bash
# 저장소 루트에서
pnpm py:sync        # = uv sync --directory backend --extra dev
```

이 한 줄이 `backend/.venv`를 만들고, `pyproject.toml`의 런타임 + `dev` extra를
설치하고, 프로젝트 자체를 편집 가능 모드로 넣는다. OS·셸 무관하게 동일하다.

**인터프리터 경로를 어디에도 적지 않는다.** venv를 손으로 활성화할 필요도 없다 —
아래 명령들은 전부 `uv run`이 알아서 `backend/.venv`를 쓴다.

<details>
<summary>uv 없이 표준 venv로 하려면</summary>

```bash
cd backend
python -m venv .venv                  # 이 머신에서 동작하는 Python 3.11+ 인터프리터로
source .venv/Scripts/activate         # Git Bash (PowerShell: .venv\Scripts\Activate.ps1)
pip install -e ".[dev]"
```

경로가 같은 `backend/.venv`라서 `uv run` 계열 명령과도 섞어 쓸 수 있다.
</details>

## 환경변수

`backend/.env` (gitignored). 템플릿은 `.env.example`.

| 키 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 클라우드 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | legacy `service_role` JWT (서버 전용, 절대 클라이언트 노출 금지). 신형 `sb_secret_...`은 이 프로젝트에서 401 — `.env.example` 주석 참고 |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (정보 표시용) |
| `ALLOWED_ORIGINS` | CORS 허용 origin (콤마 구분) |
| `ENVIRONMENT` | `development` / `test` / `production` |
| `SEED_PASSWORD` | 시드 계정 비밀번호. **기본값 없음** — 없으면 시딩이 에러로 멈춘다 |
| `DATABASE_URL` | RLS 테스트(`-m rls`) 전용 Postgres 직결 DSN |

## 실행

```bash
# 루트 monorepo에서 (권장)
pnpm dev:backend

# backend/ 안에서 직접
uv run uvicorn src.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/api/v1/health

## 테스트

```bash
# 루트에서
pnpm test:backend               # 전체 (rls 마커 제외)
pnpm test:rls                   # RLS 권한 경계 (DATABASE_URL 필요)

# backend/ 안에서 직접 — 범위를 좁힐 때
uv run --extra dev pytest tests/health -v
uv run --extra dev pytest tests/health/test_router.py::test_health_returns_ok -v
```

## 도메인 추가법

본 백엔드는 layer 분리(`api/v1/endpoints/`) 대신 **도메인 폴더**로 구성. 새 기능 1개 = 1 폴더.

```
src/<new_domain>/
├── __init__.py
├── router.py       # APIRouter — 엔드포인트 정의 (얇게)
├── schemas.py      # Pydantic request/response 모델
├── service.py      # Supabase 호출, audit 호출, 비즈니스 로직
└── exceptions.py   # (선택) 도메인 예외
```

절차:
1. `mkdir src/<new_domain>` + `__init__.py` 생성
2. `router.py`, `schemas.py`, `service.py` 작성
3. `src/api_router.py`에 한 줄 추가:
   ```python
   from src.<new_domain>.router import router as <new_domain>_router
   api_router.include_router(<new_domain>_router)
   ```
4. `mkdir tests/<new_domain>` + `__init__.py` + 테스트 파일

다른 도메인 호출 시:
```python
from src.<new_domain> import service as <new_domain>_service
```

## 현재 디렉토리

```
backend/
├── src/
│   ├── main.py              # FastAPI 인스턴스 + CORS + lifespan
│   ├── api_router.py        # 도메인 router 통합 (prefix=/api/v1)
│   ├── core/                # config (pydantic-settings), lifespan
│   ├── common/              # supabase_admin client, 공통 예외
│   ├── auth/                # JWT 검증, role 가드 (Task 4)
│   ├── health/              # /health 엔드포인트
│   ├── academies/           # admin 학원 CRUD (Task 5)
│   ├── impersonation/       # admin → 원장 magic link (Task 11)
│   ├── provisioning/        # 원장이 선생님·학부모·학생 발급 (Task 6)
│   ├── imports/             # csv 일괄 등록 (Task 7)
│   └── audit/               # admin 활동 로그 (Task 5)
├── tests/                   # 위와 동일한 도메인 폴더 구조
├── pyproject.toml           # src layout
├── .env.example
└── .env                     # gitignored
```
