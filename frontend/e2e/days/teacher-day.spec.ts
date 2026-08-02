import path from 'node:path'
import { type Page, test, expect } from '@playwright/test'

// 시드된 상태에서 시작해 단독 실행이 가능하다. 다른 하루 스펙에 의존하지 않는다.
// 과제 제목·자료 제목은 실행마다 유니크 — --reset 없이 반복 실행해도 목록이 모호해지지 않는다.
//
// 주의(task-10 handoff): testInfo.testId는 (프로젝트·파일·테스트 제목)의 해시라 실행마다
// 값이 같다. Date.now()를 반드시 덧붙여야 재실행 시에도 실제로 유니크하다.
//
// 예외(task-6 리뷰): 맨 아래 '선생님: 대기 중 상담을 확정한다'는 위 규칙의 예외다 — 새 행을
// 만드는 대신 시드가 심어둔 상담 행을 제자리에서 requested → confirmed로 변형한다. 그래서
// --reset 없이 이 파일을 두 번 돌리면 두 번째 실행에서는 카드가 이미 confirmed라 '확정'
// 버튼을 못 찾고 실패하고, 그 사이 --reset 없는 시드가 한 번 더 돌면 ensure_consultation이
// status='requested' 행을 못 찾아 같은 reason의 행을 하나 더 심어 셀렉터가 2건에 매치되는
// strict mode 위반이 날 수 있다. pnpm test:scenario와 이 파일의 실행 커맨드는 둘 다
// seed:reset을 선행하므로 실제 실행 경로에서는 영향이 없다 — 이 주석은 "--reset 없이 이
// 파일만 반복 실행"하는 경우에 한해서만 유효하다.

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
  // 이 테스트는 순차적으로 세 개의 toPass 재시도 단위를 쌓는다: 세션 진입(20s) → 출결
  // 클릭(15s) → 리로드 확인(30s, 아래 근거). 합은 65s로, playwright.config.ts의 전역
  // 테스트 타임아웃(30s)을 넘는다 — 전역값은 다른 3개 day 프로젝트에는 과하므로 여기서만
  // 개별로 올린다(전역 config를 만지지 않는다). 65s + 페이지 이동·설정 등 재시도 루프
  // 바깥의 여유(~25s)를 더해 90s로 잡는다 — 세 재시도가 전부 최악의 경우로 겹쳐도 실제로
  // 끝까지 돌 수 있는 값이다(선언된 예산이 하니스에 의해 조용히 잘리지 않도록). 실측
  // 확인(Task 13): `testInfo.timeout`이 정확히 90000으로 해석되는 것을 직접 로그로
  // 확인했다 — 선언한 예산이 하니스에 의해 조용히 30s로 잘리지 않는다는 뜻이다.
  test.setTimeout(90_000)

  await page.goto('/teacher/schedule')

  // 브리프는 "오늘 셀 → 팝업"이 바로 보인다고 가정했지만, 실제로는 기본 뷰(주간)가 day
  // 쿼리파라미터 없이는 SessionPopup을 렌더링하지 않는다(ScheduleCalendar.tsx:69 — `day &&`
  // 조건부). 주간 목록의 각 세션 행 자체가 `?day=YYYY-MM-DD`로 가는 링크라 먼저 그걸 눌러야
  // 팝업이 나타난다. 오늘 세션은 시드가 제목에 "오늘"을 박아둬(`[DEV SEED] 오늘`) 날짜를
  // 하드코딩하지 않고도 안정적으로 특정할 수 있다.
  const todayLink = page.getByRole('link', { name: /오늘/ })

  // /teacher/sessions/[id]로 가는 유일한 링크 — '오늘' 클릭으로 뜬 SessionPopup(SessionPopup.tsx:85).
  // 상태가 upcoming이면 링크 자체가 없다(시드가 세션을 KST 00:05로 만들어 이미 지난 시각이라
  // empty/in_progress/completed 중 하나가 되도록 보장). 링크 라벨은 상태에 따라
  // '출결 입력하기'(empty·in_progress) 또는 '회차 보기'(completed)로 갈린다 — 반복 실행 시
  // 이전 실행이 이미 출결을 채워 completed가 됐을 수 있으므로 둘 다 받는다.
  const detailLink = page
    .getByRole('link', { name: /출결 입력하기|회차 보기/ })
    .first()

  // 실측(Task 11): '오늘' 클릭 직후 팝업이 day 쿼리파라미터로 새로 RSC 렌더링되는 타이밍과
  // 겹치면 그 다음 상세 링크 클릭이 씹혀 URL이 전혀 안 바뀐 채로 소모되는 경우가 재현됐다.
  //
  // 추가 실측(Task 13): 상세 링크만 재시도해서는 부족했다 — '오늘' 클릭 그 자체(현재 이
  // 줄)도 같은 하이드레이션 레이스에 걸릴 수 있고, 그게 씹히면 day 파라미터가 아예 안 붙어
  // 팝업이 영영 뜨지 않는다. 그 상태에서 상세 링크만 재시도하면 존재하지도 않는 링크를
  // 계속 찾다가(각 시도 3s) 바깥 toPass 예산(당시 15s)을 전부 소진하고 "Timeout 15000ms
  // exceeded while waiting on the predicate"로 실패한다 — 실측 시 캡처한 페이지 스냅샷이
  // 여전히 주간 목록 화면이었고 SessionPopup 자체가 없었다(day 파라미터 미적용). 두 클릭을
  // **하나의 재시도 단위**로 묶어, 상세 링크를 못 찾으면 '오늘'부터 다시 누르게 한다. 둘 다
  // 순수 `<Link>` 네비게이션(부작용 없음)이라 전체를 재시도해도 안전하다. 각 클릭에 짧은
  // 개별 timeout을 줘서(3s) 한 번의 느린 시도가 바깥 예산을 통째로 태우지 않고 실제로 여러
  // 차례 재시도할 여지를 남긴다.
  await expect(async () => {
    await todayLink.click({ timeout: 3000 })
    await detailLink.click({ timeout: 3000 })
    await expect(page).toHaveURL(/\/teacher\/sessions\/[0-9a-f-]{36}$/, {
      timeout: 2000,
    })
  }).toPass({ timeout: 20_000 })

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
  //
  // 실측(Task 13): AttendanceRow의 pick()은 upsertAttendanceAction을 startTransition
  // 안에서 `void`로 fire-and-forget 호출한다 — await가 없어 클라이언트에 "서버 커밋
  // 완료" 신호가 전혀 없다(위 toPass가 확인하는 건 setStatus로 즉시 바뀌는 클라이언트
  // 상태일 뿐, 서버 반영 여부와 무관). 리로드가 실제 커밋보다 먼저 도착하면 이 단언은
  // "아직 반영 안 된 진짜 상태"를 읽고 정직하게 실패한다(셀렉터 문제가 아님).
  // page.reload()는 순수 GET이라 부작용이 없어 재시도해도 안전하다(제출 버튼처럼 재시도가
  // 중복 insert를 만들 위험이 없음) — 커밋이 반영될 때까지 리로드+단언을 한 단위로 묶어
  // 재시도한다. 검증 대상은 여전히 initialStatus(서버 상태)이므로, 재시도는 통과를
  // 만들어내는 게 아니라 "결국 서버에 실제로 반영됐는지"를 확인하는 것이다.
  //
  // 예산 30s의 근거: --reset 직후 그 세션에 대한 첫 쓰기(가장 느린 경우)를 조용한 환경에서
  // 3회 계측하니 6.5~6.9s였다(Task 13) — 30s는 그 값의 약 4.3배로, 부하로 인한 변동을
  // 흡수하기에 넉넉한 여유다. 최초 조사 중 관측했던 훨씬 심한 지연(수십 초~2분)은 동시
  // 워크트리가 같은 Supabase 프로젝트에 부하를 주던 시점과 겹쳐 있었다 — 이 재시도는
  // "이 세션의 이 쓰기"가 정상적으로 지연되는 상황을 견디도록 설계된 것이지, 시스템 전체가
  // 경합 중인 상황까지 흡수하도록 설계된 게 아니다(그 경우 이 단계만이 아니라 테스트의 다른
  // 모든 단계도 함께 느려지므로, 이 한 timeout을 무한정 늘리는 것으로 해결할 문제가 아니다).
  await expect(async () => {
    await page.reload()
    await expect(page.getByRole('button', { name: '김학생 출' })).toHaveClass(
      /bg-green-500/,
      { timeout: 3000 }
    )
  }).toPass({ timeout: 30_000 })
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

  // 카드 제목만으로는 46297a1(업로드 경로 반 스코프)의 회귀를 못 잡는다 — materials 행은
  // Postgres 테이블이라 storage 경로와 무관하게 항상 정상 조회된다. 첨부가 실제로 "읽히는지"는
  // MaterialCard가 렌더하는 signedFiles[*].url(service.ts의 createSignedUrls, RLS 적용된
  // 사용자 세션으로 호출)까지 내려가야 검증된다: MaterialForm의 pathPrefix가
  // `{academyId}/{classId||'all'}`에서 반 세그먼트를 잃으면 storage.foldername(name)[2]가
  // NULL이 되어 mfiles_member_read 정책이 그 반 학생(=정당한 소유자)에게도 신호URL을
  // 내주지 못한다(모두에게 안 보이는 방향의 회귀라 크로스클래스 유출 테스트로는 못 잡는다).
  // 링크 존재(href) 확인에서 그치지 않고 실제로 GET해 스토리지 정책을 통과하는지까지 본다.
  const attachmentLink = studentPage.locator(`[data-material-title="${title}"] a`)
  await expect(attachmentLink).toBeVisible()
  const href = await attachmentLink.getAttribute('href')
  expect(
    href,
    '첨부 링크(href)가 없습니다 — 서명 URL 생성이 실패했다는 뜻(스토리지 경로/정책 회귀 가능성)'
  ).toBeTruthy()
  const download = await studentPage.request.get(href!)
  expect(
    download.ok(),
    `학생이 방금 올라온 첨부를 다운로드하지 못했습니다(status=${download.status()}) — ` +
      'material-files storage 정책이 반 스코프를 잘못 검사하고 있을 수 있습니다'
  ).toBeTruthy()

  await studentCtx.close()
})

// 시드가 심어둔 대기 중 상담(`[SEED] 진로 상담 요청`)을 확정한다.
// playwright.config.ts의 프로젝트 순서가 owner → teacher → student → parent로 고정이고
// workers: 1이라, 여기서 확정해두면 뒤에 도는 parent-day는 requested가 비워진 상태에서
// 새 신청을 만들 수 있다(uq_consultation_pending 충돌 회피). 순서를 바꾸지 말 것.
test('선생님: 대기 중 상담을 확정한다', async ({ page }) => {
  await page.goto('/teacher/consultations')

  const card = page.locator('[data-consultation-reason="[SEED] 진로 상담 요청"]')
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: '확정' }).click()

  // 이 파일 자신의 경고(위 헤더 주석)대로, 하이드레이션 전 클릭은 조용한 no-op이 될 수
  // 있다. 다이얼로그가 실제로 열렸는지 여기서 먼저 확인해두면, 열리지 않았을 때 아래
  // fill()의 30초 타임아웃(원인 불명)이 아니라 이 줄에서 바로 원인이 드러난다.
  await expect(page.getByRole('dialog')).toBeVisible()

  // KST 기준 7일 뒤 15:00 — datetime-local은 'YYYY-MM-DDTHH:mm'
  const kst = new Date(Date.now() + 9 * 3600_000 + 7 * 24 * 3600_000)
  const ymd = kst.toISOString().slice(0, 10)
  await page.getByLabel('상담 시각').fill(`${ymd}T15:00`)
  await page.getByLabel('안내 메모 (선택)').fill('상담실에서 뵙겠습니다.')
  await page.getByRole('button', { name: '확정', exact: true }).last().click()

  // 양성 단언 — 카드가 남아 있고 상태가 실제로 '확정'으로 바뀌었는지.
  // 이게 없으면 다이얼로그가 조용히 실패해도 통과한다.
  await expect(card.getByText('확정', { exact: true })).toBeVisible()
})
