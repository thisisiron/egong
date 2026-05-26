'use client'

import { BUSINESS_TYPE_OPTIONS, type BusinessType } from '../types'

type Props = {
  value: BusinessType | null
  onChange: (v: BusinessType) => void
  /** input name (FormData 키) */
  name?: string
}

export function BusinessTypeRadio({ value, onChange, name = 'business_type' }: Props) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUSINESS_TYPE_OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`text-left p-4 rounded-lg border transition ${
                selected
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
              }`}
              aria-pressed={selected}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{opt.icon}</span>
                <span className="font-semibold text-slate-900">{opt.label}</span>
              </div>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{opt.description}</p>
              {!opt.requiresFile && (
                <p className="mt-2 text-[11px] text-amber-700 font-semibold">
                  * 별도 서류 없이 신청 가능
                </p>
              )}
            </button>
          )
        })}
      </div>
      {/* hidden input — FormData 로 전달 */}
      <input type="hidden" name={name} value={value ?? ''} />
    </div>
  )
}
