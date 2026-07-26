import { test, expect } from '@playwright/test'

// 시드된 상태에서 시작해 단독 실행이 가능하다. 다른 하루 스펙에 의존하지 않는다.
// 반 이름·공지 제목은 실행마다 유니크 — --reset 없이 반복 실행해도 목록이 모호해지지 않는다.
//
// 주의: testInfo.testId는 (프로젝트·파일·테스트 제목)의 해시라 실행마다 값이 같다
// (실측 확인 — 같은 spec을 두 번 돌려도 동일 문자열). 그걸로 "유니크 이름"을 만들면
// 두 번째 실행부터 동일 이름의 반/공지가 누적되어 getByText가 strict-mode 위반으로
// 깨진다. 실행마다 실제로 달라지는 Date.now()를 붙여 진짜 유니크하게 만든다.
test('원장: 대시보드 → 반 개설 → 목록 반영', async ({ page }, testInfo) => {
  const className = `E2E반-${testInfo.testId.slice(0, 8)}-${Date.now()}`

  await page.goto('/owner')
  await expect(page.getByRole('complementary')).toBeVisible()

  await page.goto('/owner/classes/new')
  await page.getByLabel('반 이름').fill(className)
  await page.getByLabel('레벨').selectOption('middle')
  await page.getByRole('button', { name: '생성' }).click()
  // 생성은 서버 액션 → redirect(`/owner/classes/{id}`). 클릭 직후 goto로 목록에
  // 바로 가면 서버의 insert+redirect보다 먼저 도착하는 레이스가 실측으로 확인됨
  // (목록에 방금 만든 반이 없는 채로 검증이 통과해버림). 상세 페이지 도착을 먼저 기다린다.
  // 주의: `[^/]+$`만 쓰면 현재 URL(/owner/classes/new)의 "new"도 매치해 즉시(대기 없이)
  // 통과해버려 같은 레이스를 재현한다 — UUID 형태로 좁혀 실제 리다이렉트만 매치한다.
  await page.waitForURL(/\/owner\/classes\/[0-9a-f-]{36}$/)

  await page.goto('/owner/classes')
  await expect(page.getByText(className)).toBeVisible()
})

test('원장: 공지 등록 → 목록 반영', async ({ page }, testInfo) => {
  const title = `E2E공지-${testInfo.testId.slice(0, 8)}-${Date.now()}`

  await page.goto('/owner/announcements')
  // 실측: 네트워크가 잠잠해지기 전(=클라이언트 하이드레이션 완료 전)에 클릭하면
  // 버튼이 DOM상 보여도 onClick이 아직 붙지 않아 클릭이 씹히고, 이후 getByLabel('제목')이
  // 테스트 전체 타임아웃(30s)까지 조용히 대기하다 실패한다 — networkidle로 그 레이스를 없앤다.
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: '글작성' }).click()
  await page.getByLabel('제목').fill(title)
  await page.getByLabel('내용').fill('e2e 공지 본문')
  // brief의 /등록|저장|올리기/ 는 실제 마크업과 불일치 — AnnouncementCreateForm.tsx 105행은 '게시'.
  await page.getByRole('button', { name: '게시', exact: true }).click()

  await expect(page.getByText(title)).toBeVisible()
})

test('원장: 시드 콘텐츠가 전부 보인다', async ({ page }) => {
  await page.goto('/owner/materials')
  await expect(
    page.locator('[data-material-title="[SEED] 반1 전용 자료"]')
  ).toBeVisible()
  await expect(
    page.locator('[data-material-title="[SEED] 반2 전용 자료"]')
  ).toBeVisible()
})
