import { test, expect } from '@playwright/test'

test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, 'admin env not set')

test('전체 플로우: admin이 학원 생성 → 원장 화면 보임', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(process.env.ADMIN_EMAIL!)
  await page.getByLabel('비밀번호').fill(process.env.ADMIN_PASSWORD!)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByText('학원 관리')).toBeVisible()
})
