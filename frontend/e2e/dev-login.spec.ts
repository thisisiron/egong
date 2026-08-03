import { test, expect } from '@playwright/test'

// dev 퀵 로그인 스모크.
// 사전조건:
//   1. seed_dev_accounts.py --reset-passwords 로 시드 (5개 계정 비밀번호는 SEED_PASSWORD 값)
//   2. frontend/.env.local 에 DEV_LOGIN_ENABLED=1
//   3. 셸 환경변수 DEV_LOGIN_ENABLED=1 (미설정 시 skip — 기존 스펙들의 env 가드 패턴과 동일)
const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === '1'

test.describe('dev 퀵 로그인', () => {
  test.skip(!devLoginEnabled, 'DEV_LOGIN_ENABLED 미설정')

  test('배너와 역할 버튼 5개가 보인다', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('DEV 빠른 로그인')).toBeVisible()

    for (const label of ['원장', '선생', '학생', '학부모', '운영자']) {
      await expect(
        page.getByRole('button', { name: new RegExp(label) }),
        `${label} 버튼이 보이지 않음`,
      ).toBeVisible()
    }
  })

  test('학생 → /me, 이어서 원장 → /owner (로그아웃 없이 전환)', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: /학생/ }).click()
    await page.waitForURL('**/me')

    // 로그아웃하지 않고 곧바로 다른 역할로 전환 — 이 기능의 핵심 목적
    await page.goto('/login')
    await page.getByRole('button', { name: /원장/ }).click()
    await page.waitForURL('**/owner')
  })
})
