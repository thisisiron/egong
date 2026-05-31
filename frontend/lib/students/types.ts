export type StudentStatus = 'enrolled' | 'paused' | 'graduated'

export type StudentRow = {
  id: string
  name: string
  school: string | null
  grade: string | null
  status: StudentStatus
}

export type StudentDetail = StudentRow & {
  academy_id: string
}

export type ParentLink = {
  parent_id: string
  name: string
  phone: string | null
  relationship: string
}

export type ClassAssignment = {
  assignment_id: string // class_students.id
  class_id: string
  class_name: string
  class_level: string
  joined_at: string
  left_at: string | null
}

/** 학생 상세 페이지가 필요로 하는 데이터 (page는 이 하나만 호출). */
export type StudentDetailView = {
  student: StudentDetail
  parentLinks: ParentLink[]
}

/** ChildAssignment 컴포넌트가 필요로 하는 배정 데이터. */
export type StudentAssignmentsView = {
  active: ClassAssignment[]
  history: ClassAssignment[]
}
