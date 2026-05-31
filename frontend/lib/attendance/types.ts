export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export type AttendanceRecord = {
  student_id: string
  status: AttendanceStatus
  excused_reason: string | null
  needs_makeup: boolean
}
