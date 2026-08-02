import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { formatDateTimeKR } from '@/lib/format'

import { SLOT_LABEL, type Consultation } from '../types'
import { ConsultationHandleDialog } from './ConsultationHandleDialog'
import { ConsultationStatusBadge } from './ConsultationStatusBadge'

export function StaffConsultationBoard({ rows }: { rows: Consultation[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">상담 요청이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-2"
          data-consultation-reason={r.reason}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ConsultationStatusBadge status={r.status} />
              <span className="text-sm font-medium">
                {r.student_name} · {r.parent_name}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              희망 {format(parseISO(r.preferred_date), 'M월 d일 (E)', { locale: ko })}{' '}
              {SLOT_LABEL[r.preferred_slot]}
            </span>
          </div>

          <p className="text-sm whitespace-pre-wrap">{r.reason}</p>

          {r.status === 'confirmed' && r.scheduled_at && (
            <p className="text-sm text-emerald-700" data-testid="consultation-scheduled-at">
              {/* scheduled_at은 timestamptz라 date-fns format(parseISO(...))은 기기 로컬
                  타임존으로 읽는다 — KST 고정을 위해 ConsultationList.tsx와 동일하게
                  formatDateTimeKR(Intl, timeZone: 'Asia/Seoul' 고정)을 쓴다. 위
                  preferred_date는 date-only('YYYY-MM-DD')라 영향 없음. */}
              확정 {formatDateTimeKR(r.scheduled_at)}
              {r.handler_name && ` · ${r.handler_name}`}
            </p>
          )}

          {/* 스태프가 자기가 방금 확정·반려하며 남긴 메모를 다시 확인할 수 있어야 한다 —
              ConsultationList.tsx(학부모 화면)와 동일한 블록. 없으면 반려 사유를 학부모에게
              뭐라 보냈는지 스태프 쪽에서 확인할 방법이 없다. */}
          {r.response_note && (
            <p className="text-xs text-slate-500">학원 메모: {r.response_note}</p>
          )}

          {r.status === 'requested' && (
            <div className="flex gap-2">
              <ConsultationHandleDialog
                consultationId={r.id}
                mode="confirm"
                trigger={<Button size="sm">확정</Button>}
              />
              <ConsultationHandleDialog
                consultationId={r.id}
                mode="reject"
                trigger={
                  <Button size="sm" variant="outline">
                    반려
                  </Button>
                }
              />
            </div>
          )}

          {/* 대기 중(requested) 카드에는 취소를 두지 않는다 — 반려 사유는 필수인데 취소는
              선택이라, 대기 중 건에 취소를 열어두면 사유 없이 요청을 종결할 길이 생겨 반려의
              사유 필수 규칙이 우회된다. "이 신청을 받지 않겠다"는 반려, "잡은 약속을
              무르겠다"는 취소로 의미를 가른다. 강사 일정 변경 등으로 확정된 상담을 해제할
              경로는 여전히 필요하므로 confirmed에만 남긴다. */}
          {r.status === 'confirmed' && (
            <div className="flex gap-2">
              <ConsultationHandleDialog
                consultationId={r.id}
                mode="cancel"
                trigger={
                  <Button size="sm" variant="outline">
                    취소하기
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
