import { requireRole } from '@/lib/auth'

import { CsvImportForm } from './_components/CsvImportForm'

export default async function ImportStudentsPage() {
  await requireRole(['owner'])

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">학생 csv 일괄 등록</h1>
      <div className="bg-white border border-amber-100 rounded-lg p-6 space-y-4">
        <div className="text-sm text-slate-600">
          <p className="font-semibold mb-1">컬럼: name (필수), school, grade</p>
          <pre className="bg-amber-50 border border-amber-100 rounded p-2 text-xs whitespace-pre">
{`name,school,grade
홍길동,양산고,1
김철수,양산여고,2`}
          </pre>
        </div>
        <CsvImportForm />
      </div>
    </div>
  )
}
