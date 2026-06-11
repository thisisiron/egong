import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createAnnouncementAction } from '../actions'
import type { ScopeOption } from '../types'

type Props = {
  scopeOptions: ScopeOption[]
  /** owner만 true — "학원 전체" 옵션 노출 */
  allowAcademyWide: boolean
}

export function AnnouncementCreateForm({ scopeOptions, allowAcademyWide }: Props) {
  return (
    <form action={createAnnouncementAction} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="ann-class">대상</Label>
        <select
          id="ann-class"
          name="class_id"
          defaultValue={allowAcademyWide ? '' : (scopeOptions[0]?.id ?? '')}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {allowAcademyWide ? <option value="">학원 전체</option> : null}
          {scopeOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ann-title">제목</Label>
        <Input id="ann-title" name="title" required maxLength={200} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ann-body">내용</Label>
        <Textarea id="ann-body" name="body" required rows={4} maxLength={5000} />
      </div>
      <Button type="submit">게시</Button>
    </form>
  )
}
