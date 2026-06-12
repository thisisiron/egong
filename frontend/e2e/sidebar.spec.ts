import { test, expect } from '@playwright/test'

// 계정은 docs/DEV_ACCOUNTS.local.md — 시드 후 env로 주입해서 실행
test.skip(!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD, 'owner env not set')

async function loginAsOwner(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(process.env.OWNER_EMAIL!)
  await page.getByLabel('비밀번호').fill(process.env.OWNER_PASSWORD!)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/owner/)
}

test('사이드바: 메뉴 표시 + 이동 + 활성 하이라이트', async ({ page }) => {
  await loginAsOwner(page)
  const sidebar = page.getByRole('complementary')
  await expect(sidebar.getByRole('link', { name: '학생' })).toBeVisible()
  await sidebar.getByRole('link', { name: '학생' }).click()
  await expect(page).toHaveURL(/\/owner\/students/)
})

test('사이드바: 접기 상태가 새로고침 후 유지된다', async ({ page }) => {
  await loginAsOwner(page)
  await page.getByRole('button', { name: '사이드바 접기' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '사이드바 펼치기' })).toBeVisible()
})

test('모바일: 햄버거 → 드로어 → 이동 시 닫힘', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await loginAsOwner(page)
  await page.getByRole('button', { name: '메뉴 열기' }).click()
  const drawer = page.getByRole('dialog', { name: '메뉴' })
  await expect(drawer.getByRole('link', { name: '학생' })).toBeVisible()
  await drawer.getByRole('link', { name: '학생' }).click()
  await expect(page).toHaveURL(/\/owner\/students/)
  await expect(drawer).toBeHidden()
})

test('대시보드: 학원명 헤더 + 통계 카드 + 위젯', async ({ page }) => {
  await loginAsOwner(page)
  await expect(page.getByText('학생 수')).toBeVisible()
  await expect(page.getByText('오늘 출석률')).toBeVisible()
  await expect(page.getByText('이번 달 수업')).toBeVisible()
  await expect(page.getByText('최근 공지')).toBeVisible()
})
