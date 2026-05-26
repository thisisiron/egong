'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { BusinessVerification } from '../types'

const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

const VALID_STYLE: Record<
  BusinessVerification['valid_kind'],
  { bg: string; text: string; icon: string; canSubmit: boolean }
> = {
  match: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    icon: '✓',
    canSubmit: true,
  },
  mismatch: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-800',
    icon: '❌',
    canSubmit: false,
  },
  unknown: {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-700',
    icon: '?',
    canSubmit: false,
  },
}

type Props = {
  /** 부모가 검증 결과를 알아야 신청 제출 차단 결정 가능 */
  onChange: (result: BusinessVerification | null) => void
}

/**
 * NTS 진위확인 패널: 사업자번호 + 대표자성명 + 개업일자 3개 입력.
 *
 * - "확인" 클릭 시 백엔드 `/business/validate` 호출
 * - 일치(match) 시 상태(계속/휴업) 정보까지 함께 표시
 * - 불일치(mismatch)/조회실패(unknown) 시 신청 제출 차단
 *
 * 3개 input의 name 속성은 그대로 둬서 FormData에도 같이 실린다 (서버 액션이
 * business_number, business_owner_name 등을 그대로 받는 호환성 유지).
 */
export function BusinessVerification({ onChange }: Props) {
  const [bNo, setBNo] = useState('')
  const [pNm, setPNm] = useState('')
  const [startDt, setStartDt] = useState('') // YYYY-MM-DD (date input)
  const [result, setResult] = useState<BusinessVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function resetResult() {
    if (result) {
      setResult(null)
      onChange(null)
    }
  }

  function handleCheck() {
    setError(null)
    resetResult()

    const digits = bNo.replace(/\D/g, '')
    if (digits.length !== 10) {
      setError('사업자번호 10자리를 정확히 입력해주세요')
      return
    }
    if (!pNm.trim()) {
      setError('대표자성명을 입력해주세요')
      return
    }
    const startDigits = startDt.replace(/\D/g, '')
    if (startDigits.length !== 8) {
      setError('개업일자를 정확히 입력해주세요 (YYYY-MM-DD)')
      return
    }

    startTransition(async () => {
      try {
        const resp = await fetch(`${BACKEND_BASE}/business/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            b_no: digits,
            p_nm: pNm.trim(),
            start_dt: startDigits,
          }),
        })
        if (!resp.ok) {
          throw new Error(`조회 실패 (HTTP ${resp.status})`)
        }
        const data = (await resp.json()) as BusinessVerification
        setResult(data)
        onChange(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다')
      }
    })
  }

  function handleClear() {
    setResult(null)
    setError(null)
    onChange(null)
  }

  const style = result ? VALID_STYLE[result.valid_kind] : null

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
      <p className="text-xs text-slate-600">
        국세청에 등록된 사업자등록증 정보 3개를 입력해주세요. 진위확인 통과 시에만 신청이 진행됩니다.
      </p>

      <div className="space-y-1">
        <Label htmlFor="business_number">사업자등록번호 *</Label>
        <Input
          id="business_number"
          name="business_number"
          value={bNo}
          onChange={(e) => {
            setBNo(e.target.value)
            resetResult()
          }}
          placeholder="123-45-67890"
          maxLength={12}
          inputMode="numeric"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="business_owner_name">대표자성명 *</Label>
        <Input
          id="business_owner_name"
          name="business_owner_name"
          value={pNm}
          onChange={(e) => {
            setPNm(e.target.value)
            resetResult()
          }}
          placeholder="홍길동"
          autoComplete="off"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="business_start_dt">개업일자 *</Label>
        <Input
          id="business_start_dt"
          name="business_start_dt"
          type="date"
          value={startDt}
          onChange={(e) => {
            setStartDt(e.target.value)
            resetResult()
          }}
        />
        <p className="text-xs text-slate-500">사업자등록증 상의 개업연월일</p>
      </div>

      <div className="flex gap-2 pt-1">
        {result ? (
          <Button type="button" variant="outline" onClick={handleClear} className="flex-1">
            다시 입력
          </Button>
        ) : (
          <Button type="button" onClick={handleCheck} disabled={pending} className="flex-1">
            {pending ? '확인 중...' : '진위확인'}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && style && (
        <div
          aria-live="polite"
          className={`rounded-md border p-3 text-sm ${style.bg}`}
        >
          <p className={`font-semibold ${style.text}`}>
            {style.icon} {result.valid_label}
          </p>

          {result.valid_kind === 'match' && (
            <>
              {result.status_label && (
                <p className={`mt-1 text-xs ${style.text}`}>
                  국세청 상태: <strong>{result.status_label}</strong>
                </p>
              )}
              {result.tax_type_label && (
                <p className={`mt-0.5 text-xs ${style.text} opacity-80`}>
                  {result.tax_type_label}
                </p>
              )}
              {result.end_date && (
                <p className={`mt-0.5 text-xs ${style.text}`}>
                  폐업일자: {result.end_date}
                </p>
              )}
            </>
          )}

          {result.valid_msg && result.valid_kind !== 'match' && (
            <p className={`mt-1 text-xs ${style.text} opacity-80`}>{result.valid_msg}</p>
          )}

          {!style.canSubmit && (
            <p className="mt-2 text-xs text-red-700 font-semibold">
              {result.valid_kind === 'mismatch'
                ? '입력 정보가 국세청 기록과 일치하지 않습니다. 사업자등록증을 다시 확인해주세요.'
                : '국세청에서 확인할 수 없습니다. 잠시 후 다시 시도해주세요.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
