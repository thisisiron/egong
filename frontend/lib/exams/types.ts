/** 성적·시험 도메인 타입. 순수 타입 — 클라이언트 컴포넌트에서도 import 가능. */

export type Exam = {
  id: string
  academy_id: string
  class_id: string
  title: string
  exam_type: string | null
  scope: string | null
  exam_date: string
  max_score: number
  published_at: string | null
  created_by: string | null
  created_at: string
}

export type ExamWithClass = Exam & { class_name: string | null }

/** 스태프 목록 한 줄 — 입력 진행도 포함. recorded = 점수 입력 + 미응시 표시. */
export type ExamListRow = ExamWithClass & {
  roster_count: number
  recorded_count: number
}

export type ExamScore = {
  id: string
  exam_id: string
  student_id: string
  academy_id: string
  class_id: string
  score: number | null
  is_absent: boolean
  memo: string | null
  created_at: string
  updated_at: string
}

/** 점수 입력 화면 한 줄 — 명단(학생) + 그 학생 점수(아직 없을 수 있음). */
export type ExamRosterRow = {
  student_id: string
  student_name: string
  score: number | null
  is_absent: boolean
  memo: string | null
}

export type ExamWithRoster = {
  exam: ExamWithClass
  roster: ExamRosterRow[]
}

/** 스태프용 반 통계 — 실제 응시자 기준. */
export type ExamStats = {
  avg_pct: number | null
  max_pct: number | null
  taker_count: number
}

/** exam_report_for_student RPC 한 행. */
export type ExamReportRow = {
  exam_id: string
  title: string
  exam_type: string | null
  scope: string | null
  exam_date: string
  max_score: number
  my_score: number | null
  my_is_absent: boolean
  class_avg_pct: number | null
  class_max_pct: number | null
  taker_count: number
}

export type ScoreEntryState = 'missing' | 'absent' | 'recorded'

/** 미입력 / 미응시 / 입력됨 3상태. 공개 전 "미입력 N명" 경고가 여기서 나온다. */
export function scoreEntryState(row: Pick<ExamRosterRow, 'score' | 'is_absent'>): ScoreEntryState {
  if (row.is_absent) return 'absent'
  if (row.score !== null) return 'recorded'
  return 'missing'
}

export const SCORE_ENTRY_LABEL: Record<ScoreEntryState, string> = {
  missing: '미입력',
  absent: '미응시',
  recorded: '입력됨',
}

/** 원점수 → 백분율. 소수 첫째자리까지. */
export function toPercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0
  return Math.round((score / maxScore) * 1000) / 10
}

/** 추이 그래프는 공개 시험이 이만큼 있어야 그린다 — 점 2개를 잇고 "추이"라 부르면 오해를 만든다. */
export const TREND_MIN_POINTS = 3

/** 리포트 기본 조회 기간(개월). 1차는 필터 UI 없이 고정. */
export const REPORT_MONTHS = 12
