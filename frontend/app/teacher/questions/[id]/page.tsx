import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getQuestion, listReplies, signQuestionFiles } from '@/lib/questions/service'
import { QuestionThread } from '@/lib/questions/components/QuestionThread'

export default async function TeacherQuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  return (
    <QuestionThread
      question={question}
      questionFiles={questionFiles}
      replies={repliesWithFiles}
      canReply
      canResolve
      academyId={question.academy_id}
    />
  )
}
