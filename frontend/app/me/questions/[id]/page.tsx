import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getMyChildren } from '@/lib/students/service'
import { getQuestion, listReplies, signQuestionFiles } from '@/lib/questions/service'
import { QuestionThread } from '@/lib/questions/components/QuestionThread'

export default async function MyQuestionDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return null
  const { id } = await params

  const question = await getQuestion(id)
  if (!question) notFound()
  const replies = await listReplies(id)
  const questionFiles = await signQuestionFiles(question.file_paths)
  const repliesWithFiles = await Promise.all(
    replies.map(async (r) => ({ ...r, signedFiles: await signQuestionFiles(r.file_paths) }))
  )

  const children = await getMyChildren()
  const myStudentIds = new Set(children.map((c) => c.id))
  const isStudent = user.role === 'student'
  const isOwnQuestion = isStudent && myStudentIds.has(question.student_id)
  const canReply = isStudent && (question.is_public || isOwnQuestion)
  const canResolve = isOwnQuestion

  return (
    <div className="space-y-4">
      <QuestionThread
        question={question}
        questionFiles={questionFiles}
        replies={repliesWithFiles}
        canReply={canReply}
        canResolve={canResolve}
        academyId={question.academy_id}
      />
    </div>
  )
}
