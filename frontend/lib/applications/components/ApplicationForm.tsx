'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { submitApplicationAction } from '../actions'
import {
  BUSINESS_TYPE_OPTIONS,
  STUDENT_COUNT_OPTIONS,
  type BusinessStatus,
  type BusinessType,
} from '../types'
import { BusinessNumberCheck } from './BusinessNumberCheck'
import { BusinessTypeRadio } from './BusinessTypeRadio'
import { FileUpload } from './FileUpload'

export function ApplicationForm() {
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleBusinessTypeChange(next: BusinessType | null) {
    setBusinessType(next)
    // 유형을 바꾸면 이전 사업자번호 검증 결과는 무효 — 다시 확인하도록 초기화.
    setBusinessStatus(null)
  }

  const selectedTypeOption = BUSINESS_TYPE_OPTIONS.find((o) => o.value === businessType)
  const fileRequired = selectedTypeOption?.requiresFile ?? false

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!businessType) {
      setError('사업자 유형을 선택하세요')
      return
    }
    if (fileRequired && !filePath) {
      setError('사업자등록증 파일을 첨부하세요')
      return
    }
    if (businessType !== 'planned') {
      if (!businessStatus) {
        setError('사업자번호 확인이 필요합니다 ("확인" 버튼을 눌러주세요)')
        return
      }
      if (businessStatus.status_kind === 'closed') {
        setError('폐업한 사업자번호로는 도입 신청을 진행할 수 없습니다.')
        return
      }
      if (businessStatus.status_kind === 'unknown') {
        setError('국세청에서 사업자번호를 찾을 수 없습니다. 다시 확인해주세요.')
        return
      }
    }
    if (!agreed) {
      setError('개인정보 수집·이용에 동의해주세요')
      return
    }

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await submitApplicationAction(formData)
      } catch (err) {
        // redirect()는 throw하지만 NEXT_REDIRECT 라서 여기 잡히지 않음.
        // 진짜 에러만 잡힘.
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Section 1: 신청자 */}
      <section className="space-y-3 bg-white border border-amber-100 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-slate-900">1. 신청자 정보</h2>
        <p className="text-xs text-slate-500">학원 원장님(또는 대리인) 연락처</p>
        <div className="space-y-3 pt-1">
          <Field label="이름" name="applicant_name" required />
          <Field label="이메일" name="applicant_email" type="email" required />
          <Field label="연락처" name="applicant_phone" required placeholder="010-1234-5678" />
        </div>
      </section>

      {/* Section 2: 학원 */}
      <section className="space-y-3 bg-white border border-amber-100 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-slate-900">2. 학원 정보</h2>
        <div className="space-y-3 pt-1">
          <Field label="학원명" name="academy_name" required placeholder="예: 일도수학" />
          <Field label="지역 (시·구)" name="academy_region" placeholder="예: 양산시" />
          <div className="space-y-1">
            <Label>학생 수 (대략)</Label>
            <div className="flex flex-wrap gap-2">
              {STUDENT_COUNT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 cursor-pointer hover:border-amber-300 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 text-sm"
                >
                  <input
                    type="radio"
                    name="academy_student_count"
                    value={opt.value}
                    className="accent-amber-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inquiry_message">문의 사항 (선택)</Label>
            <Textarea
              id="inquiry_message"
              name="inquiry_message"
              rows={4}
              placeholder="궁금하신 점이나 요청사항을 자유롭게 작성해주세요"
            />
          </div>
        </div>
      </section>

      {/* Section 3: 사업자 */}
      <section className="space-y-3 bg-white border border-amber-100 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-slate-900">3. 사업자 정보</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          직업안정법 제28조에 따라 학원사업자 신원 확인이 필요합니다. 사업자등록증·교습소
          신고증명서 또는 개원예정 시 학원설립운영등록증을 첨부해주세요.
        </p>

        <div className="space-y-3 pt-2">
          <Label className="block">사업자 유형 *</Label>
          <BusinessTypeRadio value={businessType} onChange={handleBusinessTypeChange} />
        </div>

        {businessType && (
          <>
            <div className="space-y-2 pt-2">
              <Label>
                사업자등록증 첨부 {fileRequired ? '*' : <span className="text-slate-400">(선택)</span>}
              </Label>
              <FileUpload
                currentPath={filePath}
                onUploaded={setFilePath}
                optional={!fileRequired}
              />
              <input type="hidden" name="registration_file_path" value={filePath ?? ''} />
            </div>

            <Field
              label="사업자/상호명"
              name="business_name"
              required
              placeholder={businessType === 'planned' ? '예: (예정) 일도수학' : '사업자등록증 기재명'}
            />
            <Field label="대표자명" name="business_owner_name" required />
            {businessType !== 'planned' && (
              <BusinessNumberCheck onChange={setBusinessStatus} />
            )}
          </>
        )}
      </section>

      {/* 약관 + 제출 */}
      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <span>
            개인정보 수집·이용에 동의합니다. 수집된 정보는 도입 검토·연락 목적으로만 사용되며,
            승인 시 학원 계정 발급에 활용됩니다.
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" disabled={pending} className="w-full h-12 text-base">
          {pending ? '신청 중...' : '신청하기'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {required && ' *'}
      </Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} />
    </div>
  )
}
