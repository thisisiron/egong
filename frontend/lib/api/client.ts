import { createClient } from '@/lib/supabase/server'

// The FastAPI backend mounts everything under /api/v1.
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000') + '/api/v1'

/**
 * Authenticated fetch to the FastAPI backend.
 * Forwards the current Supabase session's access_token as a Bearer token,
 * which the backend's get_current_user dependency verifies.
 *
 * Pass paths WITHOUT the /api/v1 prefix — it's already in BASE.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API ${resp.status}: ${text}`)
  }
  return resp.json() as Promise<T>
}
