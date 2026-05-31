export type ClassLevel = 'elementary' | 'middle' | 'high'

export type ClassRow = {
  id: string
  name: string
  level: ClassLevel
  description: string | null
}

export type AssignedTeacher = {
  teacher_id: string
  display_name: string
}

export type AssignedStudent = {
  assignment_id: string  // class_students.id
  student_id: string
  name: string
  school: string | null
}

export type TeacherOption = { id: string; display_name: string }
export type StudentOption = { id: string; name: string }

/** 반 상세 화면이 필요로 하는 모든 데이터 (page는 이 하나만 호출). */
export type ClassDetailView = {
  cls: ClassRow
  currentTeacher: AssignedTeacher | null
  students: AssignedStudent[]
  teacherOptions: TeacherOption[]
  availableStudents: StudentOption[]
}
