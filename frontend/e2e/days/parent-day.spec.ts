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
