import { test, expect } from '@playwright/test'

// 시드된 상태에서 시작해 단독 실행이 가능하다. 다른 하루 스펙에 의존하지 않는다.
// 읽기 전용 스펙 — 행을 만들지 않으므로 task-10/11 handoff의 "testInfo.testId +
// Date.now()" 유니크 이름 규칙은 여기서는 적용 대상이 없다.
//
// /me, /me/materials, /me/board는 student와 parent가 공유하는 라우트다. parent에게는
// getMyChildren()이 자녀(김학생)를 resolve하고, user.role === 'parent'일 때만
// ChildSelector가 렌더링된다(app/me/page.tsx, app/me/materials/page.tsx,
// app/me/board/page.tsx) — 이번 스펙은 자녀가 1명뿐인 시드 상태에서 기본 선택(children[0])이
// 정상 동작하는지를 검증한다.

test('학부모: 자녀 출석 현황이 보인다', async ({ page }) => {
  await page.goto('/me')
  await expect(page.getByText('표시할 학생 정보가 없습니다.')).toHaveCount(0)

  // 음성 단언만으로는 "출결 3종 조회가 전부 실패해도 통과"하는 구멍이 있었다 —
  // app/me/page.tsx는 attendance 3종을 .catch(() => null)로 fail-soft 처리하고,
  // 실패 시 AttendanceStats 대신 "출결 정보를 불러오지 못했습니다…" 문구를 렌더링한다.
  // 그 문구에는 위 셀렉터가 안 걸리므로, 대시보드가 완전히 깨져도 이전 단언은 통과했다.
  // 자녀 이름(김학생)으로 getMyChildren() resolve를, AttendanceStats 라벨로 출결 fail-soft
  // 분기를 타지 않았음을 각각 양성으로 증명한다.
  await expect(page.getByText('김학생')).toBeVisible()
  await expect(page.getByText('출석률 (이번 달)')).toBeVisible()
})

test('학부모: 자녀 반 자료만 보인다', async ({ page }) => {
  await page.goto('/me/materials')

  // 긍정 단언 — 페이지가 실제로 자료를 렌더링하고 있음을 증명한다. 이게 없으면 아래
  // toHaveCount(0)이 "페이지가 아예 안 뜸"에도 통과해버려 스코핑 검증이 무의미해진다.
  // (student-day.spec.ts와 동일한 근거 — task-12 self-review 참고.)
  await expect(
    page.locator('[data-material-title="[SEED] 반1 전용 자료"]')
  ).toBeVisible()
  // 같은 학원의 다른 반(반2) 전용 자료 — 김학생은 초등 미술반(반1)에만 속해 있으므로
  // 그 보호자에게도 보이면 안 된다. commit 2b17710이 고친 반 스코프 누수의 UI 계층 대응 검증.
  await expect(
    page.locator('[data-material-title="[SEED] 반2 전용 자료"]')
  ).toHaveCount(0)
})

test('학부모: 공지가 보인다', async ({ page }) => {
  await page.goto('/me/board')
  await expect(page.getByText('[SEED] 반1 공지')).toBeVisible()
})

// teacher-day가 시드 상담을 확정한 뒤에 실행된다(playwright.config.ts 프로젝트 순서
// owner → teacher → student → parent, workers: 1). 그래서 여기서는
// (1) 확정된 상담이 보이고 (2) requested가 비어 있어 새 신청이 가능하다.
test('학부모: 확정된 상담이 보인다', async ({ page }) => {
  await page.goto('/me/consultations')

  const card = page.locator('[data-consultation-reason="[SEED] 진로 상담 요청"]')
  await expect(card).toBeVisible()
  await expect(card.getByTestId('consultation-scheduled-at')).toBeVisible()
})

test('학부모: 상담을 신청한다', async ({ page }, testInfo) => {
  const reason = `상담 신청 E2E ${testInfo.testId}-${Date.now()}`

  await page.goto('/me/consultations')

  // react-day-picker v10 실측(node_modules/react-day-picker/dist/esm/labels/labelNext.js):
  // `locale={ko}`(ConsultationRequestForm.tsx)는 date-fns 포맷(월/요일 이름)에만 적용되고,
  // 다음 달 버튼의 aria-label(labelNext)은 별도 `labels` prop으로 덮어써야 하는데 이 폼은
  // 그걸 넘기지 않는다 — 실제 접근성 이름은 하드코딩된 영어 기본값 "Go to the Next Month"다.
  await page.getByRole('button', { name: 'Go to the Next Month' }).click()

  // 날짜 셀의 접근성 이름도 "1" 같은 단순 숫자가 아니다 — DayPicker.js를 보면 mode="single"이라
  // isInteractive=true가 되어 gridcell(td) 자체의 aria-label은 비워지고, 안쪽 DayButton에
  // labelDayButton(PPPP 포맷 전체 날짜, 예: "2026년 9월 1일 화요일")이 aria-label로 박힌다.
  // "name from content" 규칙상 그 값이 부모 gridcell의 접근성 이름으로 그대로 올라오므로
  // role/name으로는 특정 날짜를 안정적으로 못 집는다. 대신 gridcell에 항상 붙는
  // `data-day="YYYY-MM-DD"`(dateLib.format(date, 'yyyy-MM-dd') — 로케일 무관, CalendarDay.js)로 집는다.
  // 오늘/과거는 disabled(tomorrowKST 경계)라 항상 선택 가능한, 다음 달 1일을 고른다.
  const kstNow = new Date(Date.now() + 9 * 3600_000)
  const nextMonthFirst = new Date(
    Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 1)
  )
  const nextMonthFirstIso = nextMonthFirst.toISOString().slice(0, 10)
  await page.locator(`[data-day="${nextMonthFirstIso}"]`).click()
  await expect(page.getByTestId('consultation-picked-date')).toBeVisible()

  await page.getByLabel('희망 시간대').selectOption('afternoon')
  await page.getByLabel('상담 사유').fill(reason)
  await page.getByRole('button', { name: '상담 신청' }).click()

  const card = page.locator(`[data-consultation-reason="${reason}"]`)
  await expect(card).toBeVisible()
  await expect(card.getByText('대기 중')).toBeVisible()
})

test('학부모: 확정 상담이 대시보드 캘린더에 표시된다', async ({ page }) => {
  await page.goto('/me')

  // 양성 단언 먼저 — 캘린더 자체가 렌더링됐는지 확인하지 않으면
  // 페이지가 깨져도 아래 마커 단언이 무의미해진다.
  await expect(page.getByText('출석률 (이번 달)')).toBeVisible()

  // 확정 상담은 teacher-day가 7일 뒤로 잡았다. 이번 달을 벗어날 수 있으므로
  // 마커 존재 여부는 같은 달일 때만 단언한다.
  const kstNow = new Date(Date.now() + 9 * 3600_000)
  const kstTarget = new Date(Date.now() + 9 * 3600_000 + 7 * 24 * 3600_000)
  if (kstNow.getUTCMonth() === kstTarget.getUTCMonth()) {
    await expect(page.locator('[data-event-type="consultation"]').first()).toBeVisible()
  }
})
