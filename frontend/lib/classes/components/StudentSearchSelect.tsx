'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { StudentOption } from '@/lib/classes/types'

type Props = {
  availableStudents: StudentOption[]
}

/** 학생 추가용 이름 검색 콤보박스.
 * 이미 로드된 학원 미배정 학생 목록을 클라에서 contains 필터한다.
 * 폼 안에 들어가며 hidden `student_id`로 addClassStudentAction에 값을 전달.
 * "추가" 버튼을 포함해 선택 전 제출을 막는다(빈 student_id insert 방지).
 */
export function StudentSearchSelect({ availableStudents }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<StudentOption | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const listboxId = useId()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // blur 닫기 타이머는 remount(key 변경) 시 누수되지 않도록 정리.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    []
  )

  const disabled = availableStudents.length === 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return availableStudents
    return availableStudents.filter((s) => s.name.toLowerCase().includes(q))
  }, [query, availableStudents])

  function choose(s: StudentOption) {
    setSelected(s)
    setQuery(s.name)
    setOpen(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      // 목록이 열려있고 강조 항목이 있으면 선택(폼 제출 대신). 닫혀있으면 기본 제출 허용.
      if (open && filtered[highlight]) {
        e.preventDefault()
        choose(filtered[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <>
      <div className="relative flex-1">
        <input type="hidden" name="student_id" value={selected?.id ?? ''} />
        <Input
          type="text"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[highlight] ? `${listboxId}-opt-${highlight}` : undefined
          }
          disabled={disabled}
          placeholder={disabled ? '추가 가능한 학생 없음' : '학생 이름 검색...'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null) // 타이핑하면 선택 해제 (표시 텍스트와 id 불일치 방지)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          onBlur={() => {
            // 목록 항목 클릭 처리 후 닫기
            closeTimer.current = setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={onKeyDown}
        />
        {open && !disabled && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-200 bg-white shadow-sm"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">검색 결과 없음</li>
            ) : (
              filtered.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseDown={(e) => e.preventDefault()} // blur보다 클릭 먼저
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => choose(s)}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      i === highlight
                        ? 'bg-amber-100 text-slate-900'
                        : 'hover:bg-amber-50'
                    }`}
                  >
                    {s.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <Button type="submit" disabled={disabled || !selected}>
        추가
      </Button>
    </>
  )
}
