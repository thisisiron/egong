import Link from 'next/link'

import { getMyAcademyName } from '@/lib/academy/service'
import { listAnnouncements } from '@/lib/announcements/service'
import { RecentAnnouncementsCard } from '@/lib/announcements/components/RecentAnnouncementsCard'
import { getTodaySessionsSummary } from '@/lib/attendance/service'
import { todayAttendanceRate } from '@/lib/attendance/stats'
import { TodayAttendance } from '@/lib/attendance/components/TodayAttendance'
import { getSessionUser } from '@/lib/auth'
import { countClasses } from '@/lib/classes/service'
import { countDraftExams } from '@/lib/exams/service'
import { listSessionDaysForMonth } from '@/lib/sessions/service'
import { MonthCalendarCard } from '@/lib/sessions/components/MonthCalendarCard'
import { countStudents } from '@/lib/students/service'
import { countTeachers } from '@/lib/teachers/service'

interface StaffDashboardProps {
  /** 이 스태프 역할의 basePath (예: "/owner" | "/teacher") */
  basePath: string
  /** 역할 레이블 표시용 (예: "원장" | "선생님") */
  roleLabel: string
}

export async function StaffDashboard({ basePath, roleLabel }: StaffDashboardProps) {
  const [
    user,
    academyName,
    students,
    teachers,
    classes,
    today,
    monthDays,
    announcements,
    draftExams,
  ] = await Promise.all([
    getSessionUser(), // layout의 requireRole과 React cache 공유 — 추가 쿼리 없음
    getMyAcademyName(),
    countStudents(),
    countTeachers(),
    countClasses(),
    // fail-soft — 출결 카드 하나의 실패가 대시보드 전체를 죽이지 않게
    getTodaySessionsSummary().catch((e: unknown) => {
      console.error('오늘 출결 현황 조회 실패:', e)
      return null
    }),
    listSessionDaysForMonth().catch((e: unknown) => {
      console.error('월 세션 조회 실패:', e)
      return null
    }),
    listAnnouncements(5).catch((e: unknown) => {
      console.error('최근 공지 조회 실패:', e)
      return null
    }),
    // fail-soft — 공개 대기 카드 하나의 실패가 대시보드 전체를 죽이지 않게
    countDraftExams().catch((e: unknown) => {
      console.error('공개 대기 시험 조회 실패:', e)
      return null
    }),
  ])

  const rate = todayAttendanceRate(today)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{academyName ?? 'Egong'}</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {roleLabel} · {user?.displayName}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 content-start">
          <StatCard
            href={`${basePath}/students`}
            badge="학생"
            label="학생 수"
            value={`${students}명`}
            tone="rose"
          />
          <StatCard
            href={`${basePath}/teachers`}
            badge="선생님"
            label="선생님 수"
            value={`${teachers}명`}
            tone="sky"
          />
          <StatCard
            href={`${basePath}/classes`}
            badge="반"
            label="반 수"
            value={`${classes}개`}
            tone="emerald"
          />
          <StatCard
            badge="출결"
            label="오늘 출석률"
            value={rate.pct === null ? '—' : `${rate.pct}%`}
            sub={rate.detail}
            tone="violet"
          />
          {draftExams !== null && (
            <StatCard
              href={`${basePath}/exams`}
              badge="시험"
              label="공개 대기"
              value={`${draftExams}건`}
              sub={draftExams > 0 ? '아직 공개하지 않은 시험이 있습니다' : '모두 공개됐습니다'}
              tone="amber"
            />
          )}
        </div>
        {monthDays ? (
          <MonthCalendarCard days={monthDays} />
        ) : (
          <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-slate-400">
            이번 달 수업을 불러오지 못했습니다.
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-900">오늘 출결 현황</h2>
        {today ? (
          <TodayAttendance items={today} basePath={basePath} />
        ) : (
          <p className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-slate-400">
            오늘 출결 현황을 불러오지 못했습니다. 잠시 후 새로고침해주세요.
          </p>
        )}
      </section>

      {announcements ? (
        <RecentAnnouncementsCard items={announcements} announcementsPath={`${basePath}/announcements`} />
      ) : (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-slate-400">
          최근 공지를 불러오지 못했습니다.
        </p>
      )}
    </div>
  )
}

const TONES = {
  rose: { card: 'bg-rose-50 border-rose-100', badge: 'bg-rose-100 text-rose-700' },
  sky: { card: 'bg-sky-50 border-sky-100', badge: 'bg-sky-100 text-sky-700' },
  emerald: { card: 'bg-emerald-50 border-emerald-100', badge: 'bg-emerald-100 text-emerald-700' },
  violet: { card: 'bg-violet-50 border-violet-100', badge: 'bg-violet-100 text-violet-700' },
  amber: { card: 'bg-amber-50 border-amber-100', badge: 'bg-amber-100 text-amber-700' },
} as const

function StatCard({
  href,
  badge,
  label,
  value,
  sub,
  tone,
}: {
  href?: string
  badge: string
  label: string
  value: string
  sub?: string
  tone: keyof typeof TONES
}) {
  const t = TONES[tone]
  const body = (
    <div className={`rounded-xl border p-5 transition-shadow hover:shadow-sm ${t.card}`}>
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-600">{label}</div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.badge}`}>{badge}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
  return href ? (
    <Link
      href={href}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {body}
    </Link>
  ) : (
    body
  )
}
