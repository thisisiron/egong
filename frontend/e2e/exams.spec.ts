import { test, expect, type Page } from '@playwright/test'

// 수동 확인 필요(자동화 제외) — plan Task 9 브리핑·스펙 §8.3 기준. 자동화 비용이
// 값어치를 넘는다고 판단해 의도적으로 여기 남기고 넘어간 항목들이다:
//  · 공개된 시험이 TREND_MIN_POINTS(3개) 미만일 때 추이 그래프(ScoreTrendChart)가 감춰지는지
//  · 만점이 서로 다른 시험들이 백분율 한 축(퍼센트 정규화)에 올바르게 그려지는지
//  · 점수 입력 화면(ScoreEntryTable)이 모바일 폭(375px)에서 가로 스크롤 없이 동작하는지
//  · 시험 공개 알림이 학생·학부모에게만 가고, 링크가 역할별로 맞는지
//    (/me/exams vs /owner/exams/[id] · /teacher/exams/[id])
//  · 스태프 대시보드 "공개 대기" 카드의 배치·스타일
//  · plan Task 8 Step 9의 브라우저 체크리스트(전체) — 지금까지 실행된 적 없음

// 삭제 다이얼로그 메모(다음에 이 파일을 만질 사람을 위해): ExamAdminPanel의 "시험 삭제"
// 버튼은 클릭 시 네이티브 confirm()을 띄운다(ExamAdminPanel.tsx). Playwright는 기본적으로
// 네이티브 dialog를 자동으로 dismiss(취소 취급)하므로, 삭제를 실제로 눌러보는 테스트를
// 추가하려면 클릭 전에 반드시 accept 리스너를 걸어야 한다:
//   page.on('dialog', (d) => d.accept())
// 이걸 빼먹으면 "삭제 버튼을 눌렀는데 아무 일도 안 일어난다"처럼 보이는 원인불명 실패가 난다.
// 이 스모크 테스트는 삭제를 실행하지 않으므로 지금은 필요 없다.

// 성적·시험 스모크.
// 사전조건: seed_dev_accounts.py로 시드된 학원("테스트학원") — teacher@egong.test가
//   "초등 미술반" 담당, student@egong.test(김학생)가 그 반에 배정. 모든 계정 비밀번호 ***REMOVED***.
// 환경변수 미설정 시 skip (기존 e2e 스펙들과 동일한 게이팅).
const teacherEmail = process.env.TEACHER_EMAIL
const teacherPassword = process.env.TEACHER_PASSWORD
const studentEmail = process.env.STUDENT_EMAIL
const studentPassword = process.env.STUDENT_PASSWORD

// 기존 e2e 스펙(class-questions.spec.ts 등)과 동일한 로그인 메커니즘.
async function login(page: Page, email: string, password: string, homeGlob: string) {
  await page.goto('/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL(homeGlob)
}

test.describe('성적 스모크', () => {
  test.skip(
    !teacherEmail || !teacherPassword || !studentEmail || !studentPassword,
    'TEACHER_/STUDENT_ EMAIL·PASSWORD env 미설정',
  )

  test('A: 선생 시험 생성 → 미입력 공개 차단 → 전원 입력 후 공개 → 학생 열람', async ({ page }) => {
    const title = `E2E 시험 ${Date.now()}`

    // --- 선생: 시험 생성 ---
    await login(page, teacherEmail!, teacherPassword!, '**/teacher')
    await page.goto('/teacher/exams')

    // ExamForm(#exam-title)이 안 보이면 classes.length === 0 분기(반 없음 안내문)로
    // 폴백 렌더된 것 — 시드 선생이 담당하는 반이 없을 수 있다.
    await expect(
      page.locator('#exam-title'),
      '시험 생성 폼이 보이지 않음 — 학원에 반이 없거나 seed_dev_accounts가 아직 안 돌았을 수 있음',
    ).toBeVisible()

    await page.locator('#exam-title').fill(title)
    // ExamForm의 반 선택(select[name="class_id"])은 listClasses()로 학원 전체 반을 받아온다
    // (ExamsPageBody.tsx 주석 참조) — <select>는 기본으로 첫 옵션이 선택되므로, 학원에 반이
    // "초등 미술반" 하나뿐이라고 가정하고 그냥 두면 위험하다. 이 DB는 다른 워크트리·세션과
    // 공유돼 있어(e2e 실행 중 실제로 "E2E반-eb1fa315-..." 같은, 이 스펙이 만들지 않은 반이
    // 이미 존재해 첫 옵션으로 잡히는 걸 확인함 — 그 반은 명단이 비어 있어 뒤 단계가 전부
    // 깨진다), 반드시 이름으로 명시 선택한다.
    await page.locator('select[name="class_id"]').selectOption({ label: '초등 미술반' })
    // ExamForm의 시험일 input(name="exam_date"). 상세 화면의 ExamAdminPanel도 같은
    // name="exam_date"를 쓰지만, 그 패널은 기본 접힘 상태라(버튼만 렌더) 지금 이
    // 목록 페이지의 DOM에는 아예 존재하지 않는다 — 스코프 충돌 걱정 없음.
    await page.locator('input[name="exam_date"]').fill(new Date().toISOString().slice(0, 10))
    await page.locator('#exam-max-score').fill('25')
    await page.getByRole('button', { name: '시험 등록' }).click()

    // 생성 후 목록(ExamList)에 새 제목이 링크로 나타난다(서버 액션 → revalidatePath).
    const examLink = page.getByRole('link', { name: new RegExp(title) })
    await expect(examLink, '생성한 시험이 목록에 나타나지 않음 — 등록 액션이 실패했을 수 있음').toBeVisible()

    // --- 선생: 점수 입력 화면 진입 ---
    await examLink.click()
    await page.waitForURL(/\/teacher\/exams\/.+/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    const scoreInputs = page.locator('input[type="number"][aria-label$="점수"]')
    const initialCount = await scoreInputs.count()
    expect(
      initialCount,
      '명단이 비어 있음 — 시드 학생이 "초등 미술반"에 배정되지 않았을 수 있음(seed_dev_accounts 확인)',
    ).toBeGreaterThan(0)

    // 핵심 1: 시험을 막 만든 직후(점수 전부 미입력)엔 공개가 막혀 있어야 한다.
    await expect(
      page.getByRole('button', { name: '공개하기' }),
      '점수를 하나도 안 넣었는데 공개하기가 활성화됨 — 미입력 가드(PublishButton disabled 조건)가 깨졌을 수 있음',
    ).toBeDisabled()
    await expect(
      page.getByText(/미입력 \d+명/),
      '미입력 경고 문구("미입력 N명")가 안 보임',
    ).toBeVisible()

    // 전원 입력. 명단이 2명 이상이면 "미응시" 토글도 함께 시연한다 — 미응시로 바뀐 행은
    // 숫자 입력이 배지로 교체되므로(ScoreEntryTable) 입력창 개수가 줄어들어 매번 다시 센다.
    // 주의: 현재 seed_dev_accounts.py는 이 반에 학생을 1명(김학생/student@egong.test)만
    // 넣는다. 명단이 1명뿐인 상태에서 그 유일한 학생을 미응시로 돌려버리면, 뒤에서
    // 로그인할 studentEmail 본인의 점수가 전부 null이 되어 ExamReportBoard의 요약 타일
    // ({latest && (...)} 분기)이 통째로 사라지고 "반 평균" 검증이 실패한다 — 그래서
    // 1명뿐일 때는 미응시 시연을 건너뛰고 바로 점수를 채운다.
    if (initialCount > 1) {
      await page.getByRole('button', { name: '미응시' }).first().click()
    }
    const remaining = page.locator('input[type="number"][aria-label$="점수"]')
    const remainingCount = await remaining.count()
    for (let i = 0; i < remainingCount; i++) {
      await remaining.nth(i).fill('23')
    }
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page.getByText('저장됨'), '저장 완료 표시("저장됨")가 안 뜸 — saveExamScoresAction 실패 가능성').toBeVisible()
    await expect(page.getByText('전원 입력 완료')).toBeVisible()

    // --- 선생: 공개 ---
    // click()은 대상이 활성화될 때까지 자동 대기한다 — 저장 후 revalidatePath로
    // missingCount가 0으로 갱신되는 데 약간의 지연이 있어도 여기서 흡수된다.
    await page.getByRole('button', { name: '공개하기' }).click()
    await expect(page.getByText(/공개됨/)).toBeVisible()

    // --- 학생: 리포트 열람 ---
    await login(page, studentEmail!, studentPassword!, '**/me')
    await page.goto('/me/exams')

    // exact: true 필수 — ExamReportBoard의 요약 타일 부제("23 / 25점 · 2026-07-26 · {title}")도
    // title을 부분 문자열로 포함해서, exact 없이 getByText(title)을 쓰면 목록 행의 제목과
    // 요약 타일 부제 두 곳에 매치돼 strict mode violation이 난다(실제로 이 실행에서 확인함).
    await expect(
      page.getByText(title, { exact: true }),
      '학생 화면에 방금 공개한 시험이 안 보임',
    ).toBeVisible()
    // .first() 필수 — 공개된 시험이 누적돼 TREND_MIN_POINTS(3개) 이상이면 ScoreTrendChart의
    // 범례(ScoreTrendChart.tsx:58)에도 "반 평균" 텍스트가 또 나온다(요약 타일 라벨과 합쳐
    // 2곳). 둘 다 정상 UI이므로 어느 쪽이 매치돼도 "반 평균이 노출된다"는 확인 목적은
    // 만족한다 — 반복 실행으로 시드에 공개 시험이 쌓이면 strict mode violation이 나는 걸
    // 실제로 겪었다.
    await expect(page.getByText('반 평균').first()).toBeVisible()
    await expect(page.getByText('시험 목록')).toBeVisible()

    // 핵심 2: 타인 개별 점수가 노출되지 않는다.
    // ExamReportBoard(학생 리포트)는 애초에 "내 점수" + 집계(반 평균/최고점/응시자 수)만
    // 렌더하고, 다른 학생의 이름이나 개별 점수를 나열하는 마크업 자체가 없다(component
    // 코드에 student_name을 찍는 줄이 없음) — 구조적으로 새어나올 지점이 없다.
    // 다만 현재 시드엔 이 반에 학생이 1명(김학생)뿐이라, "실제로 두 번째 학생 세션에서
    // 봤을 때 안 보이는지"까지 교차 검증하지는 못한다 — 아래 테스트 B 참고.
  })

  // 진짜 "동료 학생에게 내 개별 점수가 안 보인다"는 같은 반에 학생이 2명 이상 배정돼
  // 있어야(A 학생으로 로그인해 B 학생의 이름·점수가 화면 어디에도 없는지) 확인할 수 있다.
  // 현재 seed_dev_accounts.py는 "초등 미술반"에 학생을 1명(김학생/student@egong.test)만
  // 넣는다 — class-questions.spec.ts의 Test B와 완전히 같은 제약이다. 두 번째 학생 시드
  // 계정이 추가되면 이 테스트를 채워 넣는다.
  test('B: 동료 학생에게 개별 점수 비노출(교차 세션 검증)', async () => {
    test.skip(true, '같은 반 두 번째 학생 시드 계정 필요 — 위 A 테스트 핵심 2 주석 참조')
  })
})
