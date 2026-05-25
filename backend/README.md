# Egong Backend (FastAPI)

도메인-드리븐 FastAPI 백엔드. 모든 admin·연동·외부 API 호출은 여기를 거침.

## 셋업 (Windows)

`python` / `python3`이 Microsoft Store stub로 잡혀있어 winget 경로를 직접 사용:

```bash
# Git Bash
cd backend
"C:/Users/ldcc/AppData/Local/Programs/Python/Python312/python.exe" -m venv .venv
source .venv/Scripts/activate

# 의존성 설치 (편집 가능 모드 + dev)
pip install -e ".[dev]"
```

venv 활성화 후엔 `python`·`pip` 명령이 venv 내부 인터프리터로 풀림. PowerShell이면 `.venv\Scripts\Activate.ps1`.

## 환경변수

`backend/.env` (gitignored). 템플릿은 `.env.example`.

| 키 | 설명 |
|---|---|
| `SUPABASE_URL` | Supabase 클라우드 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (서버 전용, 절대 클라이언트 노출 금지) |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` (정보 표시용) |
| `ALLOWED_ORIGINS` | CORS 허용 origin (콤마 구분) |
| `ENVIRONMENT` | `development` / `test` / `production` |

## 실행

```bash
# 개발 서버 (자동 reload, port 8000)
source .venv/Scripts/activate
uvicorn src.main:app --reload --port 8000

# 루트 monorepo에서:
pnpm dev:backend
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/api/v1/health

## 테스트

```bash
source .venv/Scripts/activate
pytest                          # 전체
pytest tests/health -v          # 도메인별
pytest tests/health/test_router.py::test_health_returns_ok -v   # 단일
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
