import { listQuestionsForStaff } from '@/lib/questions/service'
import { QuestionList } from '@/lib/questions/components/QuestionList'

export default async function OwnerQuestionsPage() {
  const questions = await listQuestionsForStaff()
  const unresolved = questions.filter((q) => !q.is_resolved).length
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">질문</h1>
        {unresolved > 0 && <span className="text-xs px-2 py-0.5 rounded bg-rose-50 text-rose-600">미해결 {unresolved}</span>}
      </header>
      <QuestionList questions={questions} basePath="/owner/questions" unresolvedOnly />
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">해결된 질문 보기</summary>
        <div className="mt-2"><QuestionList questions={questions.filter((q) => q.is_resolved)} basePath="/owner/questions" /></div>
      </details>
    </div>
  )
}
