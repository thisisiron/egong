import { createExamAction } from '../actions'

type Props = {
  classes: { id: string; name: string }[]
  examTypes: string[]
}

/** 시험 생성 폼. 유형은 자유 입력 + datalist 추천(학원 내 기존값) — 설정 화면 없이 표기가 수렴한다. */
export function ExamForm({ classes, examTypes }: Props) {
  if (classes.length === 0) {
    return (
      <p className="text-sm text-slate-400 bg-white border border-gray-200 rounded-lg p-6 text-center">
        먼저 반을 만들어야 시험을 등록할 수 있습니다.
      </p>
    )
  }
  return (
    <form
      action={createExamAction}
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">반</span>
          <select
            name="class_id"
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험일
          </span>
          <input
            type="date"
            name="exam_date"
            required
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험 이름
          </span>
          <input
            id="exam-title"
            name="title"
            required
            maxLength={200}
            placeholder="7월 2주차 주간테스트"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            유형 (선택)
          </span>
          <input
            name="exam_type"
            list="exam-type-options"
            maxLength={50}
            placeholder="주간테스트"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
          <datalist id="exam-type-options">
            {examTypes.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">만점</span>
          <input
            id="exam-max-score"
            type="number"
            name="max_score"
            required
            min={1}
            max={1000}
            step="0.5"
            defaultValue={100}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            시험 범위 (선택)
          </span>
          <input
            name="scope"
            maxLength={500}
            placeholder="이차함수 그래프 — 교재 3단원"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        시험 등록
      </button>
    </form>
  )
}
