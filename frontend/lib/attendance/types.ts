export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export type AttendanceRecord = {
  student_id: string
  status: AttendanceStatus
  excused_reason: string | null
  needs_makeup: boolean
}

/** 오늘 현황 카드 1장 분량의 집계 (owner 대시보드). */
export type TodaySessionSummary = {
  session_id: string
  class_id: string
  class_name: string
  scheduled_at: string // ISO
  title: string
  roster_count: number // 반 현재 명단 수
  marked: number // 출결 입력된 학생 수
  present: number
  late: number
  absent: number // absent + excused(레거시) 합산
}
