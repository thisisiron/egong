# 브랜치 통합 시 반드시 처리할 것

작성: 2026-08-03 (worktree-class-stats 작업 중 발견) · 정정: 2026-08-03 (최종 브랜치 리뷰)

> **2026-08-03 정정**: 아래 §1은 작성 당일 이후 상황이 바뀌어 원문 지시가 사실과
> 반대가 됐다. `parent-consultation`은 이미 `main`에 병합됐고(커밋 `c58bccd`), 번호
> 충돌은 **이 브랜치 쪽을 재번호하는 방향으로 이미 해소**됐다(`d9e862d`). 원문대로
> "parent-consultation을 재번호하라"를 따르면 `main`의 마이그레이션 번호를 바꿔
> 원격에 이미 적용된 두 개 장부 행을 고아로 만든다 — 절대 하지 말 것. 상세는 §1 참조.

동시에 진행됐던 브랜치는 셋이다.

| 브랜치 | 내용 | 상태 (2026-08-03) |
|---|---|---|
| `worktree-class-stats` | 반별 운영 지표 대시보드 + 보안 수정(시드 비밀번호·search_path) | 병합 대기 (이 문서 대상) |
| `worktree-env-config` | 루트 `.env` 단일 소스화 — `scripts/env-sync.mjs`, `.env.example` 3종·README 개편 | 병합 대기 |
| `worktree-parent-consultation` | 학부모 상담 기능 | **이미 `main`에 병합됨** (`c58bccd`) — 더 이상 in-flight 아님 |

---

## 1. ✅ 마이그레이션 버전 번호 충돌 — 해소됨 (재확인만 하면 됨)

**당시 우려:** `class-stats`와 `parent-consultation`이 `20260802000001`/`20260802000002`를
서로 다른 내용(class_stats vs consultations)으로 썼다. Supabase는 파일명이 아니라
숫자 접두사로만 마이그레이션을 추적(`supabase_migrations.schema_migrations`)하므로,
둘 다 원격에 그대로 push되면 나중에 push하는 쪽이 조용히 건너뛰어질 위험이 있었다.

**실제로 벌어진 일 (원격 프로젝트 기준 확인됨):**
- 원격 마이그레이션 장부에는 네 행이 있다: `20260802000001`·`20260802000002`는
  **consultation** 마이그레이션(지금 `main`에 있는 것) 소유이고, `20260803000001`·
  `20260803000002`는 **이 브랜치**(class-stats + search_path 하드닝)의 것이다.
- `consultations` 테이블·RPC들은 `class_stats_for_month`와 나란히 원격에 **이미 존재한다**.
- 충돌은 이 브랜치가 커밋 `d9e862d`에서 자신의 번호를 `20260802*` → `20260803*`로
  재번호하는 방향으로 해소됐다. `parent-consultation` 쪽 번호는 건드리지 않았다 —
  원격 장부 행 두 개를 이미 그 번호로 갖고 있는 쪽이기 때문이다.

**남은 처리 (검증만, 재번호 작업 없음):**
- [ ] 병합 후 `supabase migration list`로 네 마이그레이션(`20260802000001/2`,
      `20260803000001/2`)이 전부 applied로 잡히는지 확인
- [ ] `consultations` 테이블과 `class_stats_for_month` 함수가 둘 다 조회되는지 확인
      (하나가 다른 하나를 가리지 않았는지)

**재발 방지:**
- [ ] 마이그레이션 번호를 날짜+순번으로 손으로 짓는 관행이 원인이었다.
      `supabase migration new <name>`이 생성하는 타임스탬프를 쓰거나,
      브랜치별 접두사 규칙을 정할 것

---

## 2. 🟠 `frontend/lib/supabase/database.types.ts` 충돌

`class-stats`와, 이미 병합된 `parent-consultation`(→ `main`)이 각자 다른 시점에
재생성했다. 지금 기준으로는 `main`에 consultation 스키마가 반영된 타입이 있고,
이 브랜치에는 그게 빠진 채 class_stats 스키마만 반영된 타입이 있다 — 2-way 충돌.

**처리:**
- [ ] 수동 병합하지 말 것. §1 검증까지 끝나 모든 마이그레이션(class_stats +
      consultations + search_path 하드닝)이 원격에 적용된 상태를 확인한 뒤,
      `db:types`를 **한 번 다시 실행**해 생성본으로 덮어쓴다. 이 파일은 산출물이지
      소스가 아니다

---

## 3. 🟠 `.env.example` 3종 · `README.md` 충돌

- `class-stats`: 보안 수정으로 `SEED_PASSWORD` 항목 추가 (구 하드코딩 시드
  비밀번호를 제거한 데 따른 것 — 상세는 커밋 `87b62c8`/`f42ec79` 참조)
- `env-config`: `env:sync` 흐름에 맞춰 세 파일과 README를 통째로 개편
- `main`(구 `parent-consultation` 등): `backend/.env.example`에 `DATABASE_URL` 추가
  (`d83fe58`)

**처리:**
- [ ] `env-config`의 구조를 기준으로 삼고, 거기에 `SEED_PASSWORD`(class-stats)와
      `DATABASE_URL`(main) 두 항목을 모두 얹는다 — 어느 쪽도 빠뜨리면 안 된다
      (`DATABASE_URL` 없이는 `backend/tests/rls/` 스위트가 collection조차 못 한다)
- [ ] 병합 후, 구 하드코딩 시드 비밀번호 문자열이 추적 파일에 하나도 남지 않았는지
      `git grep`으로 재확인할 것 (정확한 검색어는 이 문서에 적지 않는다 — 아래
      "재발 방지" 참조. 공개 저장소이므로 이 값이 되살아나면 보안 회귀다)

**재발 방지:** 이 checklist 자체에 구 비밀번호 리터럴을 적지 말 것. 공개 저장소에
박제된 문서에 검색어 형태로라도 값이 남으면, "grep해서 0건 확인"이라는 체크가
그 문서 자신 때문에 영원히 실패(또는 무의미)해진다.

---

## 4. 🟡 그 외 파일 충돌 (main 기준으로 재확인, 2026-08-03)

`main`과의 diff를 기준으로 계산한 목록. 위 3개 항목 외에 아래도 겹친다:

- **`backend/.env.example`** — 위 §3에 포함(중복 기재 아님, 표로도 남겨둠). `main`이
  `DATABASE_URL`을 추가(`d83fe58`); 이 브랜치는 `SEED_PASSWORD`를 추가. **둘 다 유지.**
- **`backend/scripts/seed/{__init__,helpers,world}.py`, `backend/scripts/seed_dev_accounts.py`**
  — `main`이 상담 시드 데이터를 추가하며 같은 import 목록·`__all__`을 건드렸다.
  이 브랜치는 비밀번호를 지연 평가 `get_seed_password()`로 재작업했다(`seed/__init__.py`가
  `world.py`에서 `get_seed_password`를 재노출하는 형태). **병합 시 반드시 지연 함수
  방식을 유지하고, 모듈 최상단에 `SEED_PASSWORD` 상수를 되살리지 말 것** — 상수로
  되돌리면 import 시점에 환경변수를 요구하게 되어 `backend/tests/rls/` 스위트가
  collection 단계에서 죽는다(이 스위트는 `DATABASE_URL`만 있으면 되고
  `SEED_PASSWORD` 없이도 살아야 한다).
- **`frontend/components/layout/nav-config.ts`** — 양쪽 브랜치가 같은 배열(`NAV.owner`,
  `NAV.teacher` 등) 끝에 메뉴 항목을 추가한다. 단순 union이지만 배열 순서가
  화면 노출 순서이므로 순서 의도를 확인하며 합칠 것.
- **`frontend/e2e/days/teacher-day.spec.ts`** — 양쪽이 파일 끝에 테스트를 추가한다.
  단순 append 충돌, 내용 손실 없이 병합 가능.
- **`frontend/package.json` / `pnpm-lock.yaml`** — 스크립트 충돌(`test:unit` vs
  env-config 쪽 `env:sync` 관련 스크립트). **lockfile은 손으로 병합하지 말고,
  package.json들을 합친 뒤 재생성**할 것 (`pnpm install`로 lockfile을 다시 만든다).

---

## 5. 🟡 개발 환경 재현성 — 경로 하드코딩 제거

**원칙: 어떤 머신에서든 같은 절차로 동일한 환경을 구성할 수 있어야 한다.**
가상환경을 프로젝트 안에 두든 중앙(`~/.venvs`)에 두든 상관없다 — 중요한 것은 재현성이다.
현재는 문서와 스크립트가 특정 머신을 전제하고 있어서, 매번 절대경로로 우회하며 작업했다.

**현재 깨져 있는 것:**

| 위치 | 현재 | 문제 |
|---|---|---|
| `package.json` `test:backend` | `cd backend && pytest` | `pytest`가 PATH에 없음 (venv 미활성 시 실패) |
| `package.json` `seed:reset` | `cd backend && ./.venv/Scripts/python.exe ...` | `backend/.venv`가 존재하지 않음 |
| `package.json` `test:rls` | `cd backend && ./.venv/Scripts/python.exe -m pytest -m rls` | 동일 |
| `package.json` `db:types` | `--project-id \"$SUPABASE_PROJECT_REF\"` | bash `$VAR` 확장 — Windows(cmd.exe)에서 미동작 |
| `README.md` (Python 경로) | 특정 사용자 로컬 경로 | 다른 사용자 경로. 이 머신에 존재하지 않음 (이번 리뷰에서 플레이스홀더로 교체함) |

**처리:**
- [ ] Python 인터프리터 경로를 **어디에도 하드코딩하지 않는다.**
      `uv run` 경유, 또는 `PYTHON` 환경변수를 읽고 없으면 명확한 에러를 내는 방식을 검토
- [ ] `db:types`를 셸 비의존으로 (`cross-env` 또는 Node 스크립트). `env-config`의
      `scripts/env-sync.mjs`가 이미 유사한 문제를 다루므로 그 방식과 통일할 것
- [ ] 어떤 venv를 쓰는지 저장소가 알 수 있게 한 곳에 명시 (README 또는 전용 문서)
- [ ] 전역 Python 3.12.10이 현재 미사용 상태 — 유지할지 정리할지 결정

**참고:** 사용자 환경 원칙과 실측 현황은 `C:\Users\LOTTE\Documents\Projects\PYTHON-ENVS.md`
(저장소 밖, 로컬 문서)에 정리돼 있다. 전역에는 프로젝트 의존성을 설치하지 않으며,
예외는 `uv` 같은 환경 관리 도구뿐이다.

---

## 6. 🟡 신형 Supabase API 키가 이 프로젝트에서 동작하지 않음

`sb_secret_...` 키는 이 프로젝트에서 **모든 헤더 형식에 401**을 반환한다
(`apikey`만/`Authorization`만/둘 다 — 2026-08-03 실측). `sb_publishable_...`은 정상.
현재는 `SUPABASE_SECRET_KEY`에 레거시 `service_role` JWT를 넣어 우회 중이다.

`.env.example`은 `sb_secret_` 형식을 안내하고 있어 문서와 실제가 어긋난다.

**처리:**
- [ ] 대시보드에서 신형 secret 키를 활성화할지, 아니면 `.env.example`을 레거시 기준으로 고칠지 결정
- [ ] 3번(`.env.example` 병합)과 같이 처리

---

## 7. 🟡 병합 후 직접 할 것 — `pg_temp` 하드닝이 상담 함수를 못 봤다

이 브랜치의 `20260803000002_secdef_search_path.sql`(SECURITY DEFINER 함수 전체에
`SET search_path = public, pg_temp` 고정)은 **상담 함수들이 원격에 생기기 전에**
이미 원격에서 실행됐다(§1 참조 — 두 마이그레이션 계열이 서로 다른 시점에 push됨).
그 결과 `request_/confirm_/reject_/cancel_consultation`은 지금 원격에서 여전히
`pg_temp`가 고정되지 않은 상태다.

**처리 (병합 후, DB 명령 — 이번 리뷰의 범위 밖이라 지금 실행하지 않음):**
- [ ] `20260803000002_secdef_search_path.sql`을 **손으로 다시 한 번 실행**해
      상담 함수들도 포함시킨다 (마이그레이션 자체는 멱등 — `ALTER FUNCTION`이라
      재실행해도 안전하다)
- [ ] 이 마이그레이션 파일은 이번 리뷰에서 확장 소유(extension-owned) 함수를
      건드리지 않도록 가드 조건을 추가했다(신선한 환경에서의 `must be owner of
      function` 에러 방지용) — 원격에는 이미 적용돼 있으므로 그 편집분을 다시
      push할 필요는 없다. 손으로 재실행할 때도 파일 내용 자체는 원격 상태와
      호환된다(가드 조건은 대상 함수 집합을 좁힐 뿐 넓히지 않는다).

---

## 권장 순서

1. `env-config` 병합 — 환경 구성의 기반이 되므로 먼저
2. 5번(경로 하드코딩 제거)을 `env-config`의 방식 위에서 마무리
3. `class-stats` 병합 — §3·§4의 충돌을 위 지침대로 해소
4. §1 검증 (재번호 작업 없음 — 이미 끝나 있다)
5. 전부 병합 후 `db:types` 1회 재실행으로 §2 정리
6. §7의 `pg_temp` 재실행을 손으로 수행
7. 최종 확인: 구 시드 비밀번호 문자열이 추적 파일에 없는지 `git grep`으로 확인,
   `supabase migration list` 전부 applied, `consultations`·`class_stats_for_month`
   둘 다 실재 확인
