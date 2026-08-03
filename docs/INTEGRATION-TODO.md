# 브랜치 통합 — 종료 기록

작성: 2026-08-03 (worktree-class-stats 작업 중) · 종료: 2026-08-04

동시 진행됐던 세 브랜치(`class-stats`, `env-config`, `parent-consultation`)는 **전부 `main`에
병합됐고, 통합 시 처리하기로 한 항목도 모두 닫혔다.** 이 문서는 무엇을 왜 그렇게 했는지의
기록이며, 아래 "남은 판단"과 "재발 방지" 두 절만 앞으로도 유효하다.

## 닫힌 항목

| # | 내용 | 결과 (2026-08-04 검증) |
|---|---|---|
| 1 | 마이그레이션 번호 충돌 (`20260802000001/2`) | `class-stats` 쪽을 `20260803*`로 재번호해 해소. 로컬 파일 39개 ↔ 원격 장부 39행 일치, 네 버전 전부 applied, `consultations` 테이블과 `class_stats_for_month` 함수 둘 다 실재 확인 |
| 2 | `database.types.ts` 2-way 충돌 | 병합 후 `pnpm db:types` 재생성 — 스키마 차이 0(diff는 BOM 제거 한 줄뿐). 커밋된 타입이 이미 최신이었음 |
| 3 | `.env.example` 3종 · README 충돌 | `env-config` 구조 위에 `SEED_PASSWORD`·`DATABASE_URL`을 모두 얹어 병합 완료 |
| 4 | seed 모듈 · nav-config · e2e · lockfile 충돌 | 병합 완료. 시드 비밀번호는 지연 평가 `get_seed_password()` 방식 유지(모듈 로드 시점에 환경변수를 요구하지 않아 RLS 스위트가 살아 있다) |
| 5 | 개발 환경 재현성 — 경로 하드코딩 | `uv` 기반으로 전환. 아래 참조 |
| 6 | 신형 `sb_secret_` 키가 401 | `.env.example` 2종과 `backend/README.md`를 legacy `service_role` JWT 기준으로 정정. 신형 키를 쓰려면 대시보드에서 활성화 후 실측할 것 |
| 7 | `pg_temp` 하드닝이 상담 함수를 못 봄 | `20260803000002`를 원격에 재실행. `public`의 SECURITY DEFINER 함수 37개 전부 `search_path=public, pg_temp` — 미고정 0건 |

### 5번 상세 — 지금 구조

Python 관련 명령은 전부 `uv run --directory backend`를 거친다. **인터프리터 경로도 OS
분기도 저장소 어디에도 없다.**

- `pnpm py:sync` — `backend/.venv` 생성·동기화 (`uv sync --extra dev`)
- `backend/uv.lock` (57개 패키지 해시 고정) 을 커밋한다 — 다른 머신에서 같은 환경이 재현되는 근거
- `pnpm db:types` — 셸 의존 제거. `scripts/gen-types.mjs`가 project ref를 환경변수 →
  루트 `.env`(`SUPABASE_PROJECT_REF`, 없으면 `SUPABASE_URL`에서 추출) 순으로 찾고 출력도
  Node가 직접 쓴다. 예전의 `"$VAR"` 확장 + `>` 리다이렉션은 npm이 cmd.exe로 스크립트를
  돌리는 Windows에서 동작하지 않았다
- `[tool.ruff.lint] select`를 명시적으로 고정 — 비워두면 "그때 설치된 ruff의 기본값"을
  따라가서, ruff를 올리는 것만으로 린트 결과가 바뀐다(실제로 0.16.1에서 28건이 새로 떴다)

## 남은 판단 (저장소 밖 / 선택)

- **전역 Python 3.12.10** — `uv`가 자체 툴체인을 받아오므로 이 저장소는 더 이상 전역
  Python을 쓰지 않는다. 다른 용도가 없으면 정리 가능. 사용자 머신 판단이라 여기서 하지 않음
- **ruff 확장 규칙 채택 여부** — 0.16.1 기본값을 그대로 켜면 기존 코드에 28건이 뜬다
  (`BLE001` 13 · `SIM117` 5 · `DTZ011` 4 · `UP017` 2 · `I001` 2 · `B017` 2). 채택하려면
  `backend/pyproject.toml`의 `select`에 추가하고 코드를 함께 고칠 것. 지금은 기존 게이트를
  그대로 유지하는 쪽을 골랐다
- **신형 Supabase secret 키** — 대시보드에서 활성화할지 여부 (6번 참조)

## 재발 방지 — 계속 유효한 규칙

1. **마이그레이션 번호를 손으로 짓지 말 것.** Supabase는 파일명이 아니라 숫자 접두사로만
   추적하므로, 두 브랜치가 같은 번호를 쓰면 나중에 push하는 쪽이 **조용히 건너뛰어진다**.
   `supabase migration new <name>`이 만드는 타임스탬프를 쓸 것.

2. **시드 비밀번호에 기본값을 두지 말 것.** 이 저장소는 공개돼 있고 시드 계정은 실재하는
   Supabase 프로젝트에 있다 — 코드에 적힌 기본값은 그대로 공개된 로그인 자격증명이 된다.
   실제로 두 번 발생했다: 처음엔 `world.py`의 상수로, 두 번째는 `env-config`가 만든
   `scripts/env-sync.mjs`의 `optionalWithDefault` 항목으로. **두 번째는 첫 번째를 고친
   브랜치와 다른 파일이라 병합 충돌 없이 되살아났다** — 병합 후 별도로 grep해야 잡힌다.
   지금은 `env-sync.mjs`와 `world.py` 양쪽 모두 기본값이 없고, 미설정 시 시딩 시점에
   에러로 멈춘다.

3. **이 문서에 비밀번호 리터럴을 적지 말 것.** 공개 저장소에 박제된 문서에 검색어 형태로라도
   값이 남으면 "grep해서 0건" 확인이 그 문서 자신 때문에 영원히 실패한다.
