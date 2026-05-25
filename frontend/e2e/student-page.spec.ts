import { test, expect } from '@playwright/test'

test('학부모가 자녀 학생 페이지를 본다', async ({ page }) => {
  const email = process.env.PARENT_EMAIL
  const password = process.env.PARENT_PASSWORD
  test.skip(!email || !password, 'env vars not set')

  await page.goto('/login')
  await page.getByLabel('이메일').fill(email!)
  await page.getByLabel('비밀번호').fill(password!)
  await page.getByRole('button', { name: '로그인' }).click()

  await expect(page).toHaveURL(/\/me/)
  await expect(page.getByText('출석률')).toBeVisible()
  await expect(page.getByText(/년.*월 출결/)).toBeVisible()
})
