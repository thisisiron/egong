import path from 'node:path'
import { type Page, test, expect } from '@playwright/test'

// 시드된 상태에서 시작해 단독 실행이 가능하다. 다른 하루 스펙에 의존하지 않는다.
// 과제 제목·자료 제목은 실행마다 유니크 — --reset 없이 반복 실행해도 목록이 모호해지지 않는다.
//
// 주의(task-10 handoff): testInfo.testId는 (프로젝트·파일·테스트 제목)의 해시라 실행마다
// 값이 같다. Date.now()를 반드시 덧붙여야 재실행 시에도 실제로 유니크하다.

/**
 * '과제 내기' 폼(자료·공지와 달리 composing 토글이 없어 "폼이 마운트됨" 같은 자체 하이드레이션
 * 신호가 없다)에 제목을 채우고 제출한다.
 *
 * 실측(2회차 공식 실행에서 재현): 하이드레이션 전에 제출 버튼을 클릭하면 onSubmit의
 * preventDefault가 아직 안 붙어 브라우저 네이티브 GET 제출로 폴백된다(form에 action이 없어
 * 현재 URL로 쿼리스트링을 붙여 재이동) — 페이지가 통째로 새로고침되며 입력값이 날아가고,
 * 정작 서버 액션은 전혀 호출되지 않는다(순수 브라우저 내비게이션이라 insert가 없다).
 * 바로 이 지점이 안전한 재시도 판단 근거다: URL이 바뀌었다는 건 곧 "레코드가 생성되지
 * 않았다"는 증거이므로, 그 경우에 한해 한 번 더 시도해도 중복이 생기지 않는다(두 번째
 * 시도는 방금 페이지가 완전히 새로 로드돼 JS 번들이 이미 실행된 상태라 확실히 하이드레이션돼
 * 있다). URL이 그대로면(=서버 액션이 정상 호출돼 revalidatePath로 제자리 갱신) 재시도하지
 * 않는다 — 이 갈래에서는 재시도가 진짜 중복 생성을 부를 수 있기 때문이다.
 */
async function submitAssignment(page: Page, title: string) {
  await page.getByLabel('반').selectOption({ label: '초등 미술반' })
  await page.getByLabel('제목').fill(title)
  const urlBeforeSubmit = page.url()
  await page.getByRole('button', { name: '과제 내기' }).click()

  const fellBackToNativeSubmit = await page
    .waitForURL((url) => url.toString() !== urlBeforeSubmit, { timeout: 3000 })
    .then(() => true)
    .catch(() => false)

  if (fellBackToNativeSubmit) {
    await page.goto('/teacher/assignments')
    await page.getByLabel('반').selectOption({ label: '초등 미술반' })
    await page.getByLabel('제목').fill(title)
    await page.getByRole('button', { name: '과제 내기' }).click()
  }
}

test('선생: 오늘 회차 출결 입력', async ({ page }) => {
  await page.goto('/teacher/schedule')

  // 브리프는 "오늘 셀 → 팝업"이 바로 보인다고 가정했지만, 실제로는 기본 뷰(주간)가 day
  // 쿼리파라미터 없이는 SessionPopup을 렌더링하지 않는다(ScheduleCalendar.tsx:69 — `day &&`
  // 조건부). 주간 목록의 각 세션 행 자체가 `?day=YYYY-MM-DD`로 가는 링크라 먼저 그걸 눌러야
  // 팝업이 나타난다. 오늘 세션은 시드가 제목에 "오늘"을 박아둬(`[DEV SEED] 오늘`) 날짜를
  // 하드코딩하지 않고도 안정적으로 특정할 수 있다.
  await page.getByRole('link', { name: /오늘/ }).click()

  // /teacher/sessions/[id]로 가는 유일한 링크 — 방금 뜬 SessionPopup(SessionPopup.tsx:85).
  // 상태가 upcoming이면 링크 자체가 없다(시드가 세션을 KST 00:05로 만들어 이미 지난 시각이라
  // empty/in_progress/completed 중 하나가 되도록 보장). 링크 라벨은 상태에 따라
  // '출결 입력하기'(empty·in_progress) 또는 '회차 보기'(completed)로 갈린다 — 반복 실행 시
  // 이전 실행이 이미 출결을 채워 completed가 됐을 수 있으므로 둘 다 받는다.
  const detailLink = page
    .getByRole('link', { name: /출결 입력하기|회차 보기/ })
    .first()
  // 실측: 위 '오늘' 클릭 직후 팝업이 day 쿼리파라미터로 새로 RSC 렌더링되는 타이밍과 겹치면
  // 이 링크 클릭이 씹혀 URL이 전혀 안 바뀐 채로 소모되는 경우가 재현됐다(제출 폼의 하이드레이션
  // 레이스와는 다른 결이지만 같은 "DOM이 막 바뀌는 순간의 클릭 유실" 계열). 이 클릭은 순수
  // 페이지 이동(Link)이라 부작용이 없어 재시도해도 안전하다 — 클릭+네비게이션 성공을 한
  // 단위로 묶어 재시도한다.
  await expect(async () => {
    await detailLink.click()
    await expect(page).toHaveURL(/\/teacher\/sessions\/[0-9a-f-]{36}$/, {
      timeout: 2000,
    })
  }).toPass({ timeout: 15_000 })

  const presentBtn = page.getByRole('button', { name: '김학생 출' })
  // AttendanceRow는 세션 상세 진입 직후 등장하는 client component라 공지 '글작성'과 동일한
  // 하이드레이션 레이스 가능성이 있다. 이 클릭은 upsertAttendanceAction(같은 session_id·
  // student_id에 대한 upsert)이라 멱등 — 재시도해도 중복 레코드가 생기지 않는다. 버튼도
  // 언마운트되지 않고 계속 같은 자리에 남아 재클릭 가능하므로 toPass로 안전하게 재시도한다.
  await expect(async () => {
    await presentBtn.click()
    await expect(presentBtn).toHaveClass(/bg-green-500/, { timeout: 2000 })
  }).toPass({ timeout: 15_000 })

  // 리로드해도 유지되는지 확인 — 버튼 색이 클라이언트 상태(useState)만 바뀐 게 아니라
  // 서버에 실제로 저장돼 새 페이지 로드 시 initialStatus로 되돌아온 것인지 검증한다.
  await page.reload()
  await expect(page.getByRole('button', { name: '김학생 출' })).toHaveClass(
    /bg-green-500/
  )
})

test('선생: 과제 부여 → 목록 반영', async ({ page }, testInfo) => {
  const title = `E2E과제-${testInfo.testId.slice(0, 8)}-${Date.now()}`

  await page.goto('/teacher/assignments')
  // 브리프는 '과제' 토글 버튼을 먼저 누르라고 했지만 실제 마크업(app/teacher/assignments/page.tsx)은
  // 토글 없이 AssignmentForm이 페이지에 항상 바로 렌더링된다 — composing 패턴이 아니다.
  // 과제 내기는 서버 액션으로 새 레코드를 insert하므로 제출 클릭에 무조건 재시도를 감싸면
  // 중복 생성 위험이 있다 — submitAssignment()가 "네이티브 GET 폴백이면 insert가 없었다는
  // 뜻이니 안전하게 재시도" 판단까지 포함해 처리한다(자세한 근거는 함수 주석 참고).
  await submitAssignment(page, title)

  await expect(page.getByText(title)).toBeVisible()
})

test('선생이 올린 자료를 학생이 즉시 본다', async ({ page, browser }, testInfo) => {
  const title = `E2E자료-${testInfo.testId.slice(0, 8)}-${Date.now()}`

  await page.goto('/teacher/materials')

  const titleInput = page.getByLabel('제목')
  // MaterialBoard(42행)의 '자료 올리기' 토글 버튼 — 공지 '글작성'과 동일한 composing 패턴.
  // 순수 클라이언트 상태 전환(setComposing(true))이고 성공 시 이 버튼 자체가 언마운트되므로
  // toPass로 재시도해도 안전하다.
  await expect(async () => {
    await page.getByRole('button', { name: '자료 올리기' }).click()
    await expect(titleInput).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 15_000 })

  // 대상 = 초등 미술반 (학생이 속한 반). 학원 전체로 두면 반 경계 검증이 안 된다.
  await page.getByLabel('대상').selectOption({ label: '초등 미술반' })
  await titleInput.fill(title)

  // createMaterialSchema는 파일 1개 이상을 요구한다(materialFilesSchema.min(1)) — 첨부 없이는
  // 제출이 서버에서 거부된다. StorageFileUpload는 숨겨진 <input type="file">이라 라벨이 아니라
  // input을 직접 찾아 첨부한다.
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(__dirname, '..', 'fixtures', 'e2e-upload.png'))

  const submitBtn = page.getByRole('button', { name: '자료 올리기' })
  // 업로드가 끝나야(uploading=false) 버튼이 활성화된다 — 활성화를 기다리면 files state가
  // 이미 채워져 있음이 보장된다(StorageFileUpload.handleSelect: onChange 후 uploading=false).
  await expect(submitBtn).toBeEnabled()
  // 위 토글 클릭에서 하이드레이션이 이미 확인됐으므로(폼이 실제로 마운트됨) 여기서부터는
  // React 이벤트 바인딩을 다시 의심할 이유가 없다. 이 클릭은 서버 액션으로 자료 레코드를
  // insert하므로 재시도로 감싸지 않는다 — 실제 반영 신호(카드 등장)를 단일 클릭 뒤에 기다린다.
  await submitBtn.click()
  await expect(page.locator(`[data-material-title="${title}"]`)).toBeVisible()

  // 두 번째 컨텍스트 — 스펙 순서에 의존하지 않고 역할 교차를 확인한다.
  const studentCtx = await browser.newContext({
    storageState: 'playwright/.auth/student.json',
  })
  const studentPage = await studentCtx.newPage()
  await studentPage.goto('/me/materials')
  await expect(
    studentPage.locator(`[data-material-title="${title}"]`)
  ).toBeVisible()
  await studentCtx.close()
})
