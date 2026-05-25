'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export async function upsertAttendanceAction(input: {
  session_id: string
  student_id: string
  status: AttendanceStatus
  excused_reason?: string | null
  needs_makeup?: boolean
}) {
  await requireRole(['teacher'])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('not authenticated')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase.from('attendance').upsert(
    {
      session_id: input.session_id,
      student_id: input.student_id,
      status: input.status,
      excused_reason: input.excused_reason ?? null,
      needs_makeup: input.needs_makeup ?? false,
      marked_by: teacher?.id ?? null,
      marked_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,student_id' }
  )

  if (error) throw new Error(error.message)
  revalidatePath(`/teacher/sessions/${input.session_id}`)
}

export async function updateVideoUrlAction(formData: FormData) {
  await requireRole(['teacher'])
  const sessionId = String(formData.get('session_id'))
  const videoUrl = String(formData.get('video_url') || '').trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('sessions')
    .update({ video_url: videoUrl })
    .eq('id', sessionId)
  if (error) throw new Error(error.message)
  revalidatePath(`/teacher/sessions/${sessionId}`)
}
