import { type Page, test, expect } from '@playwright/test'

// 시드된 상태에서 시작해 단독 실행이 가능하다. 다른 하루 스펙에 의존하지 않는다.
// 질문 제목은 실행마다 유니크 — --reset 없이 반복 실행해도 목록이 모호해지지 않는다.
//
// 주의(task-10/11 handoff): testInfo.testId는 (프로젝트·파일·테스트 제목)의 해시라 실행마다
// 값이 같다. Date.now()를 반드시 덧붙여야 재실행 시에도 실제로 유니크하다.

/**
 * '질문하기' 폼(`QuestionForm.tsx`)은 자료·공지와 달리 composing 토글이 없이 조건 충족 시
 * 페이지에 바로 렌더링된다(과제 폼과 동일한 구조) — 하지만 `<form onSubmit>`에 `action`
 * 속성이 없는 것도 과제 폼과 동일하다. task-11 handoff #6이 지적한 것과 같은 위험이 있다:
 * 하이드레이션 전에 제출 버튼을 클릭하면 React의 onSubmit(=preventDefault)이 아직 안 붙어
 * 브라우저 네이티브 GET 제출로 폴백되고(현재 URL에 폼 값을 쿼리스트링으로 붙여 재이동),
 * 서버 액션은 전혀 호출되지 않는다(=insert가 없다). 이 성질을 이용해 "URL이 바뀌었는가"로
 * insert 여부를 판별하고, 안 일어났을 때만(=중복 위험이 없을 때만) 재시도한다.
 */
async function submitQuestion(page: Page, title: string) {
  async function fillAndSubmit() {
    // getByLabel('반')는 라벨 없는 체크박스의 접근성 이름("같은 반 친구들도 볼 수 있게 공개")에도
    // "반"이 포함돼 있어 strict-mode 위반(2개 매치)이 난다 — exact: true로 select만 특정한다.
    await page.getByLabel('반', { exact: true }).selectOption({ label: '초등 미술반' })
    await page.getByLabel('제목').fill(title)
    await page.getByLabel('내용').fill('e2e 질문 본문')
    const urlBeforeSubmit = page.url()
    await page.getByRole('button', { name: '질문하기' }).click()
    return page
      .waitForURL((url) => url.toString() !== urlBeforeSubmit, { timeout: 3000 })
      .then(() => true)
      .catch(() => false)
  }

  const fellBackToNativeSubmit = await fillAndSubmit()
  if (fellBackToNativeSubmit) {
    // 네이티브 GET 제출은 순수 브라우저 내비게이션이라 서버 액션이 호출되지 않았다는 증거다
    // (insert가 없었음) — 그 경우에 한해 깨끗한 페이지에서 한 번 더 시도해도 중복이 없다.
    await page.goto('/me/questions')
    await fillAndSubmit()
  }
}

test('학생: 대시보드에 출석 현황이 보인다', async ({ page }) => {
  await page.goto('/me')
  await expect(page.getByText('표시할 학생 정보가 없습니다.')).toHaveCount(0)

  // 음성 단언만으로는 "출결 3종 조회가 전부 실패해도 통과"하는 구멍이 있었다 —
  // app/me/page.tsx는 attendance 3종을 .catch(() => null)로 fail-soft 처리하고,
  // 실패 시 AttendanceStats 대신 "출결 정보를 불러오지 못했습니다…" 문구를 렌더링한다.
  // 그 문구에는 위 셀렉터가 안 걸리므로, 대시보드가 완전히 깨져도 이전 단언은 통과했다.
  // AttendanceStats가 실제로 렌더링됐다는 양성 신호로 fail-soft 분기를 타지 않았음을 증명한다.
  await expect(page.getByText('출석률 (이번 달)')).toBeVisible()
})

test('학생: 자기 반 자료만 보인다', async ({ page }) => {
  await page.goto('/me/materials')

  // 긍정 단언 — 페이지가 실제로 자료를 렌더링하고 있음을 증명한다. 이게 없으면 아래
  // toHaveCount(0)이 "페이지가 아예 안 뜸"에도 통과해버려 스코핑 검증이 무의미해진다.
  await expect(
    page.locator('[data-material-title="[SEED] 반1 전용 자료"]')
  ).toBeVisible()
  await expect(
    page.locator('[data-material-title="[SEED] 학원 전체 자료"]')
  ).toBeVisible()
  // 같은 학원의 다른 반(반2) 전용 자료 — 김학생은 초등 미술반(반1)에만 속해 있으므로
  // 보이면 안 된다. commit 2b17710이 고친 반 스코프 누수의 UI 계층 대응 검증.
  await expect(
    page.locator('[data-material-title="[SEED] 반2 전용 자료"]')
  ).toHaveCount(0)
})

test('학생: 질문 등록 → 목록 반영', async ({ page }, testInfo) => {
  const title = `E2E질문-${testInfo.testId.slice(0, 8)}-${Date.now()}`

  await page.goto('/me/questions')
  await submitQuestion(page, title)

  await expect(page.getByText(title)).toBeVisible()
})

test('학생: 과제가 보인다', async ({ page }) => {
  await page.goto('/me/assignments')
  await expect(page.getByText('[SEED] 반1 과제')).toBeVisible()
})
