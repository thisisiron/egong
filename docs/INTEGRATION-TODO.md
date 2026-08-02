# 브랜치 통합 시 반드시 처리할 것

작성: 2026-08-03 (worktree-class-stats 작업 중 발견)

동시에 진행 중인 브랜치가 셋이고, 서로 같은 파일·같은 마이그레이션 번호를 건드리고 있다.
개별 병합 시점에 하나씩 처리하면 놓치기 쉬우므로 **통합 시 한 번에** 해결한다.

| 브랜치 | 내용 |
|---|---|
| `worktree-class-stats` | 반별 운영 지표 대시보드 + 보안 수정(시드 비밀번호·search_path) |
| `worktree-env-config` | 루트 `.env` 단일 소스화 — `scripts/env-sync.mjs`, `.env.example` 3종·README 개편 |
| `worktree-parent-consultation` | 학부모 상담 기능 |

---

## 1. 🔴 마이그레이션 버전 번호 충돌 — 조용히 실패한다

**가장 위험한 항목.** 두 브랜치가 같은 버전 번호를 서로 다른 내용으로 쓰고 있다.

| 버전 | `class-stats` | `parent-consultation` |
|---|---|---|
| `20260802000001` | `_class_stats.sql` | `_consultations.sql` |
| `20260802000002` | `_secdef_search_path.sql` | `_consultation_rpc.sql` |

**현재 원격 DB 상태 (2026-08-03 실측):**
- `20260802000001`, `20260802000002`가 **이미 applied로 기록**돼 있다 — class-stats 쪽 내용이다
  (`class_stats_for_month` 함수 존재 확인)
- `consultations` 테이블은 원격에 **없다** — parent-consultation은 아직 push하지 않았다

**무슨 일이 벌어지는가:** Supabase는 파일명이 아니라 **숫자 접두사로만** 마이그레이션을 추적한다
(`supabase_migrations.schema_migrations`). parent-consultation을 병합한 뒤 `db push`하면
CLI가 두 버전을 "이미 적용됨"으로 판단해 **조용히 건너뛴다.** 상담 테이블·RPC가 생성되지 않고
에러도 나지 않는다. 문제는 한참 뒤 "상담 페이지가 안 된다"로 드러난다.

**처리:**
- [ ] `parent-consultation`의 마이그레이션 2개를 **재번호 부여** (`20260803000001`, `20260803000002` 등).
      class-stats 쪽은 이미 원격에 적용됐으므로 번호를 바꾸면 안 된다
- [ ] 재번호 후 `supabase migration list`로 두 쌍이 모두 pending으로 잡히는지 확인
- [ ] `db push` 후 `consultations` 테이블과 RPC가 실제로 생겼는지 조회로 검증
      (적용 성공 메시지만으로 판단하지 말 것)

**재발 방지:**
- [ ] 마이그레이션 번호를 날짜+순번으로 손으로 짓는 관행이 원인이다.
      `supabase migration new <name>`이 생성하는 타임스탬프를 쓰거나,
      브랜치별 접두사 규칙을 정할 것

---

## 2. 🟠 `frontend/lib/supabase/database.types.ts` 3중 충돌

`class-stats`와 `parent-consultation`이 **각자 재생성**했다. 둘 다 실제 DB에서 뽑은 것이지만
시점이 달라 내용이 다르다.

**처리:**
- [ ] 수동 병합하지 말 것. 모든 마이그레이션을 적용한 뒤 `db:types`를 **한 번 다시 실행**해
      생성본으로 덮어쓴다. 이 파일은 산출물이지 소스가 아니다
- [ ] 단, 1번(번호 충돌)을 먼저 해결해야 한다. 그러지 않으면 상담 스키마가 빠진 타입이 생성된다

---

## 3. 🟠 `.env.example` 3종 · `README.md` 충돌

- `class-stats`: 보안 수정으로 `SEED_PASSWORD` 항목 추가 (하드코딩된 `***REMOVED***` 제거에 따른 것)
- `env-config`: `env:sync` 흐름에 맞춰 세 파일과 README를 통째로 개편

**처리:**
- [ ] `env-config`의 구조를 기준으로 삼고, 거기에 `SEED_PASSWORD` 항목을 얹는다
- [ ] 병합 후 `git grep -nI "***REMOVED***"`가 **0건**인지 반드시 재확인.
      공개 저장소이므로 이 값이 되살아나면 보안 회귀다

---

## 4. 🟡 `package.json` 스크립트 충돌

- `class-stats`: `test:unit` 추가 (루트·frontend 양쪽)
- `env-config`: `env:sync` 관련 스크립트 추가

단순 병합으로 해결되지만, 아래 5번과 함께 손보는 김에 정리한다.

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
| `README.md:10`, `README.md:19` | `C:/Users/ldcc/AppData/.../python.exe` | 다른 사용자 경로. 이 머신에 존재하지 않음 |

**처리:**
- [ ] Python 인터프리터 경로를 **어디에도 하드코딩하지 않는다.**
      `uv run` 경유, 또는 `PYTHON` 환경변수를 읽고 없으면 명확한 에러를 내는 방식을 검토
- [ ] `db:types`를 셸 비의존으로 (`cross-env` 또는 Node 스크립트). `env-config`의
      `scripts/env-sync.mjs`가 이미 유사한 문제를 다루므로 그 방식과 통일할 것
- [ ] `README.md`의 특정 사용자 경로 두 곳을 재현 가능한 절차로 교체
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

## 권장 순서

1. `env-config` 병합 — 환경 구성의 기반이 되므로 먼저
2. 5번(경로 하드코딩 제거)을 `env-config`의 방식 위에서 마무리
3. `class-stats` 병합 — 3번(`.env.example`) 충돌을 `SEED_PASSWORD` 유지 방향으로 해결
4. `parent-consultation` 병합 전 **1번(마이그레이션 재번호) 먼저 처리**
5. 전부 병합 후 `db:types` 1회 재실행으로 2번 정리
6. 최종 확인: `git grep -nI "***REMOVED***"` 0건, `supabase migration list` 전부 applied,
   `consultations` 테이블 실재 확인
