import { test, expect } from '@playwright/test'

test.skip(!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD, 'owner env not set')

async function loginAsOwner(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(process.env.OWNER_EMAIL!)
  await page.getByLabel('비밀번호').fill(process.env.OWNER_PASSWORD!)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/owner/)
}

test('원장 일정 페이지 진입 + 캘린더 표시', async ({ page }) => {
  await loginAsOwner(page)
  await page.getByRole('complementary').getByRole('link', { name: '일정' }).click()
  await expect(page).toHaveURL(/\/owner\/schedule/)
  await expect(page.getByRole('heading', { name: '일정' })).toBeVisible()
  await expect(page.getByRole('button', { name: '일정 추가' })).toBeVisible()
})

test('이벤트(시험) 등록 → 캘린더 범례 표시', async ({ page }) => {
  await loginAsOwner(page)
  await page.goto('/owner/schedule')
  await page.getByRole('button', { name: '일정 추가' }).click()
  await page.getByLabel('제목').fill('중간고사 E2E')
  // 종류 기본 '시험', 날짜 기본 오늘, 반 기본 '학원 전체'
  await page.getByRole('button', { name: '저장' }).click()
  // 저장 성공 시 다이얼로그가 닫힌다 (action 완료 확인)
  await expect(page.getByRole('dialog')).toBeHidden()
  // 캘린더 범례에 '시험' 라벨 표시 — 범례 컨테이너('🎬 영상' 포함)로 스코프해
  // 셀렉트 옵션/다이얼로그 텍스트와의 strict-mode 충돌을 피한다
  const legend = page.locator('div').filter({ hasText: '🎬 영상' }).last()
  await expect(legend.getByText('시험', { exact: true })).toBeVisible()
})
