import { test, expect, type Locator, type Page } from '@playwright/test'

// 반별 운영 지표 스모크.
// 사전조건: seed_dev_accounts.py --reset 으로 시드된 "테스트학원" —
//   teacher@egong.test(이선생)가 "초등 미술반"·"중등 수학반" 두 반을 모두 담당한다.
//   "중등 수학반"에는 세션이 전혀 없어 출석률이 항상 "—"다 — 정렬 검증에서 이 반이
//   "값 없는 반은 항상 맨 아래" 케이스를 구조적으로 보장한다(추가 시드 없이도).
//   과제([SEED] 반1 과제)는 due_at이 NULL이라 RPC가 분모에서 제외 — 두 반 모두 과제
//   제출률은 항상 "—"다(그래서 과제 제출률 컬럼은 실수치 단언 대상으로 쓰지 않는다).
//
//   "초등 미술반"의 출석률은 최근 6회차 세션(월/수/금, 어제부터 14일 전까지 —
//   ensure_sessions_and_attendance)에서 나온다. 이 14일 창이 이번 달에 떨어지는지
//   지난달로 넘어가는지는 실행 시점(월초냐 월중이냐)에 달려 있다 — 실제로 이 스펙을
//   작성한 시점(2026-08-03, 월초)에는 6세션이 전부 7월에 떨어져 이번 달 출석률이
//   "—"로 확인됐다. 그래서 아래 ensureArtClassHasAttendance()가 이번 달을 먼저
//   보고, 없으면 지난달로 이동해 실수치를 찾는다 — 둘 다 없으면(시드가 깨졌다는 뜻)
//   그대로 실패한다(안전망으로 skip하지 않는다).
//
// 비밀번호: SEED_PASSWORD 환경변수(하드코딩 기본값 없음 — auth.setup.ts와 동일한 게이팅).
// 미설정 시 skip이 아니라 throw — fail-soft 회귀가 그린 빌드로 위장하지 못하게 한다.
const SEED_PASSWORD = process.env.SEED_PASSWORD
if (!SEED_PASSWORD) {
  throw new Error(
    'SEED_PASSWORD 환경변수가 설정되지 않았습니다 (셸 또는 backend/.env 확인)'
  )
}

const OWNER_EMAIL = 'owner@egong.test'
const TEACHER_EMAIL = 'teacher@egong.test'

// 기존 e2e 스펙(exams.spec.ts 등)과 동일한 로그인 메커니즘.
async function login(page: Page, email: string, homeGlob: string) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(SEED_PASSWORD!)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(homeGlob)
}

/** "초등 미술반" 출석률 셀(표 컬럼 순서: 반·학생·출석률·과제 제출률 = index 2). */
function artClassAttendanceCell(table: Locator): Locator {
  return table.getByRole('row', { name: /초등 미술반/ }).getByRole('cell').nth(2)
}

/** 호출 시점에 /owner/stats(현재 달)가 이미 열려 있다고 가정하고, "초등 미술반"
 * 출석률이 실수치로 찍히는 달에 가 있도록 보장한다. 파일 상단 주석 참고. */
async function ensureArtClassHasAttendance(page: Page, table: Locator): Promise<void> {
  const cell = artClassAttendanceCell(table)
  if (/\d+%/.test((await cell.innerText()).trim())) return
  await page.getByLabel('이전 달').click()
}

test.describe('반별 운영 지표', () => {
  test('원장: 네비 진입 → 표 렌더 → 월 이동 → 컬럼 구성', async ({ page }) => {
    await login(page, OWNER_EMAIL, '**/owner')

    // 네비에서 진입 — 링크가 실제로 걸려 있는지까지 검증한다.
    // sidebar.spec.ts와 동일하게 <aside>(데스크톱 사이드바)로 스코프한다 — 모바일 드로어의
    // NavList는 열렸을 때만 마운트되므로(MobileNav.tsx) 기본 뷰포트에서는 충돌하지 않지만,
    // 관례를 맞춰 명시적으로 스코프한다.
    const sidebar = page.getByRole('complementary')
    await sidebar.getByRole('link', { name: '통계' }).click()
    await page.waitForURL('**/owner/stats*')
    await expect(page.getByRole('heading', { name: '학원 운영 지표' })).toBeVisible()

    // 양성 단언: 시드 반이 실제로 표에 있어야 한다 (빈 표가 통과하지 않게).
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('link', { name: '초등 미술반' })).toBeVisible()
    await expect(table.getByRole('link', { name: '중등 수학반' })).toBeVisible()

    // 컬럼 구성 — 정렬 가능한 두 지표 컬럼만 있고, 성적 컬럼은 없다.
    await expect(page.getByRole('columnheader', { name: /출석률/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /과제 제출률/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /성적/ })).toHaveCount(0)

    // 이번 달에 이미 실수치가 있는지 먼저 본다(월 이동 클릭 전에 — 클릭이 상태를 바꾸므로).
    const hasDataThisMonth = /\d+%/.test(
      (await artClassAttendanceCell(table).innerText()).trim()
    )

    // 월 이동 — URL 쿼리가 실제로 바뀌는지 (링크 클릭이 실제 네비게이션을 일으키는지 확인).
    await page.getByLabel('이전 달').click()
    await expect(page).toHaveURL(/[?&]month=\d{4}-\d{2}/)
    await expect(table).toBeVisible()

    // 양성 단언: "초등 미술반"은 시드 출결이 있으므로 출석률이 실제 퍼센트로 찍혀야 한다
    // (하드코딩 수치가 아니라 패턴만 — 시드 값이 바뀌어도 안 깨지게). 이번 달에 이미
    // 있었다면 방금 지난달로 이동해버렸으니 되돌아가서 확인한다 — 파일 상단 주석의
    // 월경계 설명 참고.
    if (hasDataThisMonth) {
      await page.getByLabel('다음 달').click()
    }
    await expect(artClassAttendanceCell(table)).toContainText(/\d+%/)
  })

  test('원장: 정렬 방향을 바꿔도 데이터 없는 반은 맨 아래에 남는다', async ({ page }) => {
    await login(page, OWNER_EMAIL, '**/owner')
    await page.goto('/owner/stats')

    const table = page.getByRole('table')
    await expect(table).toBeVisible()

    // "중등 수학반"은 세션이 전혀 없어 출석률이 항상 "—"다(모든 달에서 성립) — 이 테스트
    // 자체는 그것만으로도 성립한다. 다만 "초등 미술반"이 값을 가진 달로 이동해두면 표에
    // 실수치 행과 "—" 행이 섞여, 정렬이 실제로 동작하며 "—"가 맨 아래로 밀려나는지를
    // 더 의미 있게 검증할 수 있다(둘 다 "—"면 순서가 안 바뀌어도 우연히 통과할 수 있음).
    await ensureArtClassHasAttendance(page, table)

    const headerCell = page.getByRole('columnheader', { name: /출석률/ })
    const headerBtn = page.getByRole('button', { name: /출석률/ })

    // 셀 인덱스: 반(0)·학생(1)·출석률(2)·과제 제출률(3) — columns.ts의 컬럼 순서와 일치.
    const lastRowMetricCell = async () => {
      const rows = table.getByRole('row')
      const n = await rows.count()
      return (await rows.nth(n - 1).getByRole('cell').nth(2).innerText()).trim()
    }

    // 서버가 이미 출석률 오름차순(값 없는 반은 항상 맨 아래)으로 보내므로, 클릭 전
    // 초기 상태부터 "중등 수학반"("—")이 맨 아래에 있어야 한다.
    await expect(headerCell).toHaveAttribute('aria-sort', 'ascending')
    expect(await lastRowMetricCell()).toBe('—')

    // 방향 전환 1 — aria-sort가 실제로 바뀌는지(정렬이 무의미한 클릭이 아님을 증명)와
    // 무관하게, 값 없는 반은 여전히 맨 아래여야 한다.
    await headerBtn.click()
    await expect(headerCell).not.toHaveAttribute('aria-sort', 'ascending')
    expect(await lastRowMetricCell()).toBe('—')

    // 방향 전환 2.
    const afterFirstClick = await headerCell.getAttribute('aria-sort')
    await headerBtn.click()
    await expect(headerCell).not.toHaveAttribute('aria-sort', afterFirstClick ?? '')
    expect(await lastRowMetricCell()).toBe('—')
  })

  test('선생님: 담당 반만 표시되고 표가 렌더된다', async ({ page }) => {
    await login(page, TEACHER_EMAIL, '**/teacher')
    await page.goto('/teacher/stats')

    await expect(page.getByRole('heading', { name: '학원 운영 지표' })).toBeVisible()
    await expect(page.getByText(/담당 반 \d+개/)).toBeVisible()

    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('link', { name: '초등 미술반' })).toBeVisible()
    await expect(table.getByRole('link', { name: '중등 수학반' })).toBeVisible()

    // 다른 학원("테스트학원2")의 반은 teacher@egong.test 담당이 아니므로 보이면 안 된다
    // — RPC의 owner=학원 전체/teacher=담당 반 권한 분기(class_stats_for_month.sql)가
    // 실제로 스코핑되는지 확인하는 경계 검증.
    await expect(table.getByRole('link', { name: '타학원반' })).toHaveCount(0)
  })

  test('잘못된 month 파라미터는 에러 없이 이번 달로 폴백한다', async ({ page }) => {
    await login(page, OWNER_EMAIL, '**/owner')
    await page.goto('/owner/stats?month=abc')

    await expect(page.getByRole('heading', { name: '학원 운영 지표' })).toBeVisible()
    const table = page.getByRole('table')
    await expect(table).toBeVisible()
    await expect(table.getByRole('link', { name: '초등 미술반' })).toBeVisible()
    // 다음 달 버튼이 아예 없음(비활성 <span>으로 대체) = 이번 달로 폴백됐다는 증거 —
    // MonthNav는 이번 달일 때만 aria-label 없는 <span>을 렌더한다.
    await expect(page.getByLabel('다음 달')).toHaveCount(0)
  })
})
