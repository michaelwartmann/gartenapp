'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { hashPassword, verifyPassword } from '@/lib/password'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// `secure: true` cookies are dropped by browsers over plain HTTP except on
// localhost. That blocks LAN-mobile testing (http://192.168.x.x:3001), so
// scope `Secure` to production-mode only — Vercel always runs HTTPS, dev
// over LAN doesn't.
const COOKIE_SECURE = process.env.NODE_ENV === 'production'

export type LoginState =
  | { error?: 'invalid' | 'wrong-password' | 'already-set' | 'server' }
  | undefined

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type Garden = {
  id: string
  owner_name: string
  password_hash: string | null
}

async function loadGarden(name: string): Promise<Garden | null> {
  const supabase = adminClient()
  const { data } = await supabase
    .from('gardens')
    .select('id, owner_name, password_hash')
    .eq('owner_name', name)
    .maybeSingle()
  return (data as Garden | null) ?? null
}

async function issueSession(garden: Garden): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('garten_auth', 'true', {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    httpOnly: true,
  })
  cookieStore.set('garten_name', garden.owner_name, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    httpOnly: false,
  })
  cookieStore.set('garten_id', garden.id, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    httpOnly: false,
  })
}

export async function checkGardenName(
  name: string
): Promise<{ found: false } | { found: true; needsSetup: boolean }> {
  const trimmed = name.trim()
  if (!trimmed) return { found: false }
  const garden = await loadGarden(trimmed)
  if (!garden) return { found: false }
  return { found: true, needsSetup: !garden.password_hash }
}

export async function setupPassword(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const gardenName = String(formData.get('gardenName') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirmPassword') ?? '')

  if (!gardenName || password.length < 6 || password !== confirm) {
    return { error: 'invalid' }
  }

  const garden = await loadGarden(gardenName)
  if (!garden) return { error: 'invalid' }
  if (garden.password_hash) return { error: 'already-set' }

  const supabase = adminClient()
  const hash = await hashPassword(password)
  const { error } = await supabase
    .from('gardens')
    .update({ password_hash: hash, reset_token: null, reset_expires_at: null })
    .eq('id', garden.id)
  if (error) {
    console.error('setupPassword update failed:', error)
    return { error: 'server' }
  }

  await issueSession(garden)
  redirect('/')
}

export async function loginWithPassword(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const gardenName = String(formData.get('gardenName') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!gardenName || !password) return { error: 'invalid' }

  const garden = await loadGarden(gardenName)
  if (!garden || !garden.password_hash) return { error: 'wrong-password' }

  const ok = await verifyPassword(password, garden.password_hash)
  if (!ok) return { error: 'wrong-password' }

  await issueSession(garden)
  redirect('/')
}
