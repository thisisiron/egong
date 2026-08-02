import { test as setup, expect } from '@playwright/test'

// 하드코딩 기본값 없음 — 시드 비밀번호가 공개 저장소에 평문으로 남지 않게 한다.
const PASSWORD = process.env.SEED_PASSWORD
if (!PASSWORD) {
  throw new Error(
    'SEED_PASSWORD 환경변수가 설정되지 않았습니다 (셸 또는 .env.local 확인)'
  )
}

// 역할 → [이메일, 로그인 후 도달해야 하는 URL 패턴]
// 이메일은 backend/scripts/seed/world.py 의 ACCOUNTS와 일치해야 한다.
const ROLES = [
  ['owner', 'owner@egong.test', /\/owner/],
  ['teacher', 'teacher@egong.test', /\/teacher/],
  ['student', 'student@egong.test', /\/me/],
  ['parent', 'parent@egong.test', /\/me/],
] as const

for (const [role, email, urlPattern] of ROLES) {
  setup(`${role} 로그인 세션 저장`, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(PASSWORD)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(urlPattern)
    await page.context().storageState({ path: `playwright/.auth/${role}.json` })
  })
}
