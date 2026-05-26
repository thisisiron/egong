'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { BusinessStatus } from '../types'

const BACKEND_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

const STATUS_STYLE: Record<
  BusinessStatus['status_kind'],
  { bg: string; text: string; icon: string; canSubmit: boolean }
> = {
  active: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-800',
    icon: '✓',
    canSubmit: true,
  },
  paused: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    icon: '⚠',
    canSubmit: true,
  },
  closed: {
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
  /** 부모가 현재 status를 알아야 신청 차단 결정 가능 */
  onChange: (status: BusinessStatus | null) => void
  /** input name (FormData 키) */
  name?: string
}

export function BusinessNumberCheck({ onChange, name = 'business_number' }: Props) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<BusinessStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCheck() {
    setError(null)
    setStatus(null)
    onChange(null)

    const digits = value.replace(/\D/g, '')
    if (digits.length !== 10) {
      setError('사업자번호 10자리를 정확히 입력해주세요')
      return
    }

    startTransition(async () => {
      try {
        const resp = await fetch(`${BACKEND_BASE}/business/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ b_no: digits }),
        })
        if (!resp.ok) {
          throw new Error(`조회 실패 (HTTP ${resp.status})`)
        }
        const data = (await resp.json()) as BusinessStatus
        setStatus(data)
        onChange(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : '조회 중 오류가 발생했습니다')
      }
    })
  }

  function handleClear() {
    setValue('')
    setStatus(null)
    setError(null)
    onChange(null)
  }

  const statusStyle = status ? STATUS_STYLE[status.status_kind] : null

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>사업자등록번호 *</Label>
      <div className="flex gap-2">
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (status) {
              setStatus(null)
              onChange(null)
            }
          }}
          placeholder="123-45-67890"
          maxLength={12}
          inputMode="numeric"
          autoComplete="off"
        />
        {status ? (
          <Button type="button" variant="outline" onClick={handleClear}>
            다시
          </Button>
        ) : (
          <Button type="button" onClick={handleCheck} disabled={pending}>
            {pending ? '확인 중...' : '확인'}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {status && statusStyle && (
        <div className={`rounded-md border p-3 text-sm ${statusStyle.bg}`}>
          <p className={`font-semibold ${statusStyle.text}`}>
            {statusStyle.icon} {status.status_label}
          </p>
          {status.tax_type_label && (
            <p className={`mt-0.5 text-xs ${statusStyle.text} opacity-80`}>
              {status.tax_type_label}
            </p>
          )}
          {status.end_date && (
            <p className={`mt-0.5 text-xs ${statusStyle.text}`}>
              폐업일자: {status.end_date}
            </p>
          )}
          {!statusStyle.canSubmit && (
            <p className="mt-2 text-xs text-red-700 font-semibold">
              {status.status_kind === 'closed'
                ? '폐업한 사업자번호로는 도입 신청을 진행할 수 없습니다.'
                : '국세청에서 조회되지 않습니다. 사업자번호를 다시 확인해주세요.'}
            </p>
          )}
        </div>
      )}

      {!status && !error && (
        <p className="text-xs text-slate-500">
          입력 후 <strong>확인</strong>을 눌러 국세청 진위 여부를 확인합니다.
        </p>
      )}
    </div>
  )
}
