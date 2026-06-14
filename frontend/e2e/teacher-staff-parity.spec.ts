import { test, expect } from '@playwright/test'

// teacher = owner 스태프 동등화 스모크.
// 사전조건: seed_dev_accounts로 시드된 학원(teacher@egong.test, 반 "초등 미술반", 학생 "김학생").
// 환경변수: TEACHER_EMAIL, TEACHER_PASSWORD
const email = process.env.TEACHER_EMAIL
const password = process.env.TEACHER_PASSWORD

async function loginAsTeacher(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email!)
  await page.getByLabel('비밀번호').fill(password!)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('**/teacher')
}

test.describe('teacher = owner 스태프 동등', () => {
  test.skip(!email || !password, 'TEACHER_EMAIL/TEACHER_PASSWORD env 미설정')

  test('좌측 네비에 학사관리 노출, 지출 없음', async ({ page }) => {
    await loginAsTeacher(page)
    for (const label of ['대시보드', '일정', '학생', '학부모', '선생님', '반', '공지']) {
      await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: '지출', exact: true })).toHaveCount(0)
  })

  test('teacher가 학원 전체 학생 목록 조회', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('/teacher/students')
    await expect(page.getByRole('heading', { name: '학생' })).toBeVisible()
    await expect(page.getByText('김학생')).toBeVisible()
  })

  test('teacher가 반 목록·상세 조회', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('/teacher/classes')
    await expect(page.getByText('초등 미술반')).toBeVisible()
    await page.getByRole('link', { name: '상세' }).first().click()
    await expect(page).toHaveURL(/\/teacher\/classes\//)
    // 반 허브: 담임/배정 학생 섹션이 보인다
    await expect(page.getByRole('heading', { name: '담임 선생님' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /배정된 학생/ })).toBeVisible()
  })

  test('teacher 반 생성 폼이 렌더된다', async ({ page }) => {
    await loginAsTeacher(page)
    await page.goto('/teacher/classes/new')
    await expect(page.getByRole('button', { name: /생성/ })).toBeVisible()
  })
})
