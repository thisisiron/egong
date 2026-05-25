import { test, expect } from '@playwright/test'

// 사전조건: Task 6/8까지 수동 진행한 학원이 supabase에 있음.
// 환경변수: TEACHER_EMAIL, TEACHER_PASSWORD, TEST_SESSION_ID
test('선생님이 출결을 입력하면 저장된다', async ({ page }) => {
  const email = process.env.TEACHER_EMAIL
  const password = process.env.TEACHER_PASSWORD
  const sessionId = process.env.TEST_SESSION_ID
  test.skip(!email || !password || !sessionId, 'env vars not set')

  await page.goto('/login')
  await page.getByLabel('이메일').fill(email!)
  await page.getByLabel('비밀번호').fill(password!)
  await page.getByRole('button', { name: '로그인' }).click()

  await page.goto(`/teacher/sessions/${sessionId}`)
  await expect(page.getByText('학생 출결')).toBeVisible()

  // 첫 학생 출석 클릭
  const firstStudent = page.locator('[aria-label*="출"]').first()
  await firstStudent.click()

  // 영상 URL 저장
  const videoInput = page.getByPlaceholder('https://vimeo.com/')
  await videoInput.fill('https://vimeo.com/test12345')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(videoInput).toHaveValue('https://vimeo.com/test12345')
})
