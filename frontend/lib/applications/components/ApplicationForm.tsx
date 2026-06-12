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
  type BusinessVerification,
  type BusinessType,
} from '../types'
import { BusinessVerification as BusinessVerificationPanel } from './BusinessVerification'
import { BusinessTypeRadio } from './BusinessTypeRadio'
import { FileUpload } from './FileUpload'

export function ApplicationForm() {
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [verification, setVerification] = useState<BusinessVerification | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleBusinessTypeChange(next: BusinessType | null) {
    setBusinessType(next)
    // 유형을 바꾸면 이전 진위확인 결과는 무효 — 다시 확인하도록 초기화.
    setVerification(null)
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
      if (!verification) {
        setError('사업자 진위확인이 필요합니다 ("진위확인" 버튼을 눌러주세요)')
        return
      }
      if (verification.valid_kind === 'mismatch') {
        setError('국세청 진위확인에 실패했습니다. 사업자등록증 정보를 다시 확인해주세요.')
        return
      }
      if (verification.valid_kind === 'unknown') {
        setError('국세청에서 사업자등록정보를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      if (verification.status_kind === 'closed') {
        setError('폐업한 사업자번호로는 도입 신청을 진행할 수 없습니다.')
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
      <section className="space-y-3 bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-slate-900">1. 신청자 정보</h2>
        <p className="text-xs text-slate-500">학원 원장님(또는 대리인) 연락처</p>
        <div className="space-y-3 pt-1">
          <Field label="이름" name="applicant_name" required />
          <Field label="이메일" name="applicant_email" type="email" required />
          <Field label="연락처" name="applicant_phone" required placeholder="010-1234-5678" />
        </div>
      </section>

      {/* Section 2: 학원 */}
      <section className="space-y-3 bg-white border border-gray-200 rounded-lg p-5">
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 cursor-pointer hover:border-indigo-300 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50 text-sm"
                >
                  <input
                    type="radio"
                    name="academy_student_count"
                    value={opt.value}
                    className="accent-indigo-500"
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
      <section className="space-y-3 bg-white border border-gray-200 rounded-lg p-5">
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
            {businessType === 'planned' ? (
              <Field label="대표자명" name="business_owner_name" required />
            ) : (
              <BusinessVerificationPanel onChange={setVerification} />
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
            className="mt-0.5 accent-indigo-500"
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
