import { getMyTeachingClasses } from '@/lib/sessions/service'
import { SessionEditDialog } from './SessionEditDialog'
import { Button } from '@/components/ui/button'

/** 선생님 페이지 상단 "+ 수업 추가" 버튼. 다이얼로그 안에 반 드롭다운. */
export async function TeacherSessionAddButton() {
  const classes = await getMyTeachingClasses()
  if (classes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        담당하는 반이 없습니다. 원장님께 반 배정을 요청해주세요.
      </p>
    )
  }
  return (
    <SessionEditDialog
      mode="create"
      teachingClasses={classes}
      trigger={<Button type="button">+ 수업 추가</Button>}
    />
  )
}
