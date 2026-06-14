'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StorageFileUpload, type UploadedFile } from '@/components/ui/StorageFileUpload'
import { createReplyAction, toggleResolvedAction } from '../actions'
import { REPLY_ROLE_LABEL, type QuestionReply, type QuestionWithClass } from '../types'

type SignedFile = { path: string; url: string | null }

type Props = {
  question: QuestionWithClass
  questionFiles: SignedFile[]
  replies: Array<QuestionReply & { signedFiles: SignedFile[] }>
  canReply: boolean
  canResolve: boolean
  academyId: string
}

function FileLinks({ files }: { files: SignedFile[] }) {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((f, i) => (
        <a key={f.path} href={f.url ?? '#'} target="_blank" rel="noreferrer"
           className="text-xs px-2 py-1 rounded border border-slate-200 text-indigo-600">첨부 {i + 1} 열기</a>
      ))}
    </div>
  )
}

export function QuestionThread({ question, questionFiles, replies, canReply, canResolve, academyId }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [resolvePending, startResolve] = useTransition()

  function handleReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    fd.set('question_id', question.id)
    files.forEach((f) => fd.append('file_paths', f.path))
    startTransition(async () => {
      try {
        await createReplyAction(fd)
        setError(null)
        form.reset()
        setFiles([])
      } catch (err) {
        setError(err instanceof Error ? err.message : '답글 등록에 실패했습니다.')
      }
    })
  }

  function handleToggle() {
    const fd = new FormData()
    fd.set('id', question.id)
    fd.set('is_resolved', String(!question.is_resolved))
    startResolve(async () => {
      try { await toggleResolvedAction(fd) } catch { /* noop: 페이지 재검증으로 갱신 */ }
    })
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">{question.class_name}</span>
          {question.is_public
            ? <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">공개</span>
            : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">비공개</span>}
          {question.is_resolved
            ? <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">해결됨</span>
            : <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">미해결</span>}
          {canResolve && (
            <button type="button" onClick={handleToggle} disabled={resolvePending}
                    className="ml-auto text-xs text-indigo-600 hover:underline disabled:opacity-50">
              {question.is_resolved ? '미해결로 되돌리기' : '해결됨으로 표시'}
            </button>
          )}
        </div>
        <h1 className="text-lg font-semibold">{question.title}</h1>
        <p className="text-xs text-slate-500">{question.author_name} · {new Date(question.created_at).toLocaleString('ko-KR')}</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-sm whitespace-pre-wrap">{question.body}</p>
        <FileLinks files={questionFiles} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">답글 {replies.length > 0 && `(${replies.length})`}</h2>
        {replies.map((r) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-700">{r.author_name}</span>
              <span className="ml-1 px-1.5 py-0.5 rounded bg-slate-100">{REPLY_ROLE_LABEL[r.author_role]}</span>
              <span className="ml-1">· {new Date(r.created_at).toLocaleString('ko-KR')}</span>
            </p>
            <p className="text-sm whitespace-pre-wrap">{r.body}</p>
            <FileLinks files={r.signedFiles} />
          </div>
        ))}
        {replies.length === 0 && <p className="text-sm text-slate-400">아직 답글이 없습니다.</p>}
      </section>

      {canReply ? (
        <form onSubmit={handleReply} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <Textarea name="body" rows={3} required maxLength={5000} placeholder="답글을 입력하세요." />
          <StorageFileUpload bucket="question-files" pathPrefix={academyId} value={files} onChange={setFiles} multiple maxBytes={10 * 1024 * 1024} />
          {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
          <Button type="submit" disabled={pending}>{pending ? '등록 중…' : '답글 달기'}</Button>
        </form>
      ) : (
        <p className="text-xs text-slate-400">비공개 질문에는 작성자와 선생님만 답글을 달 수 있습니다.</p>
      )}
    </div>
  )
}
