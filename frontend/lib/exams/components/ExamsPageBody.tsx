import { listClasses } from '@/lib/classes/service'

import { listExamsForStaff, listUsedExamTypes } from '../service'
import { ExamForm } from './ExamForm'
import { ExamList } from './ExamList'

type Props = { basePath: string; classId?: string }

/**
 * 스태프 시험 목록 본문. owner·teacher가 공유하고 basePath만 다르다.
 * 반 목록은 listClasses(학원 전체)를 쓴다 — exams RLS가 owner·teacher parity로
 * 학원 전체 CRUD를 허용하므로(담당 반 제한 없음), 폼의 반 선택지도 학원 전체가 맞다.
 */
export async function ExamsPageBody({ basePath, classId }: Props) {
  const [exams, classes, examTypes] = await Promise.all([
    listExamsForStaff(classId),
    listClasses(),
    listUsedExamTypes(),
  ])

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">성적</h1>
      <ExamForm classes={classes} examTypes={examTypes} />
      <ExamList exams={exams} basePath={basePath} />
    </div>
  )
}
