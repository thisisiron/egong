import { test, expect, type Page } from '@playwright/test'

// 수업 질문(Q&A) 스모크.
// 사전조건: seed_dev_accounts로 시드된 학원(student@egong.test 가 어떤 반에 배정,
//   teacher@egong.test 가 해당 학원 스태프). 모든 계정 비밀번호는 SEED_PASSWORD 환경변수 값.
// 환경변수: STUDENT_EMAIL/STUDENT_PASSWORD, TEACHER_EMAIL/TEACHER_PASSWORD
//   (기존 스펙과 동일하게 미설정 시 skip)
const studentEmail = process.env.STUDENT_EMAIL
const studentPassword = process.env.STUDENT_PASSWORD
const teacherEmail = process.env.TEACHER_EMAIL
const teacherPassword = process.env.TEACHER_PASSWORD

// 기존 e2e 스펙(teacher-staff-parity, full-flow)과 동일한 로그인 메커니즘.
async function login(page: Page, email: string, password: string, homeGlob: string) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(homeGlob)
}

test.describe('수업 질문 Q&A 스모크', () => {
  test.skip(
    !studentEmail || !studentPassword || !teacherEmail || !teacherPassword,
    'STUDENT_/TEACHER_ EMAIL·PASSWORD env 미설정',
  )

  test('A: 학생 공개질문 → 선생 보드 → 답글 → 해결 처리', async ({ page }) => {
    const title = `E2E 질문 ${Date.now()}`
    const answerBody = `E2E 답글 본문 ${Date.now()}`

    // --- 학생: 질문 작성 ---
    await login(page, studentEmail!, studentPassword!, '**/me')
    await page.goto('/me/questions')

    // 질문 폼 존재 보장 — 시드 학생이 반에 배정돼 있어야 폼이 렌더된다.
    // 폼이 없으면(미배정) 명확한 메시지로 즉시 실패시키고 멈추지 않게 한다.
    await expect(
      page.locator('#q-title'),
      '질문 작성 폼이 보이지 않음 — 시드 학생이 어떤 반에도 배정되지 않았을 수 있음(seed_dev_accounts 확인)',
    ).toBeVisible()

    await page.locator('#q-title').fill(title)
    await page.locator('#q-body').fill('E2E 자동화 질문 본문입니다.')
    await page.locator('input[name="is_public"]').check()
    await page.getByRole('button', { name: '질문하기' }).click()

    // 작성 후 목록에 새 제목이 나타난다(서버 액션 revalidate 후 자동 갱신).
    await expect(page.getByText(title)).toBeVisible()

    // --- 선생: 질문 보드에서 해당 질문 열람 ---
    await login(page, teacherEmail!, teacherPassword!, '**/teacher')
    await page.goto('/teacher/questions')

    // 미해결 질문 목록에 새 질문 노출 → 클릭하여 스레드로 이동.
    const questionLink = page.getByRole('link', { name: new RegExp(title) })
    await expect(questionLink).toBeVisible()
    await questionLink.click()
    await page.waitForURL(/\/teacher\/questions\/.+/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    // --- 선생: 답글 작성 ---
    await page.locator('textarea[name="body"]').fill(answerBody)
    await page.getByRole('button', { name: '답글 달기' }).click()
    await expect(page.getByText(answerBody)).toBeVisible()

    // --- 선생: 해결됨으로 표시 ---
    await page.getByRole('button', { name: '해결됨으로 표시' }).click()
    await expect(page.getByText('해결됨', { exact: true })).toBeVisible()
  })

  // 비공개 질문이 같은 반 동료 학생에게 노출되지 않는지 확인하려면,
  // 같은 반에 배정된 "두 번째 학생" 시드 계정이 필요하다(현재 시드엔 1명).
  // 동료 학생 계정 추가 후 활성화. 수동 확인 메모는 docs/superpowers/BACKLOG.md 참조.
  test('B: 비공개 질문은 같은 반 동료 학생에게 비노출', async () => {
    test.skip(true, '동료 학생 시드 계정 추가 후 활성화 — 수동 확인 메모 참조')
  })
})
