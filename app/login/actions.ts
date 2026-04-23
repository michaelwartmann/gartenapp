'use server'

import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type LoginState = { error?: 'invalid' | 'server' } | undefined

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Cookies are set via Set-Cookie response headers (not document.cookie) so they
// land in the HTTP cookie jar that iOS Safari uses inside standalone PWAs.
// document.cookie writes don't reliably reach that jar — the symptom was the
// chip showing (JS-visible jar) while middleware redirected to /login (HTTP
// jar empty) on every PWA cold launch.
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const gardenName = String(formData.get('gardenName') || '').trim()
  const password = String(formData.get('password') || '')

  if (!gardenName || password !== 'Garten2026') {
    return { error: 'invalid' }
  }

  // Upsert the gardens row for this name so garden-scoped queries have an id
  // to key off. Uses the secret key because RLS is not configured yet; this
  // server action runs server-side only.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const { data: existing, error: findError } = await supabase
    .from('gardens')
    .select('id')
    .eq('owner_name', gardenName)
    .maybeSingle()

  if (findError) {
    console.error('login: failed to look up garden', findError)
    return { error: 'server' }
  }

  let gardenId = existing?.id as string | undefined

  if (!gardenId) {
    const { data: created, error: insertError } = await supabase
      .from('gardens')
      .insert({ owner_name: gardenName })
      .select('id')
      .single()
    if (insertError || !created) {
      console.error('login: failed to create garden', insertError)
      return { error: 'server' }
    }
    gardenId = created.id
  }

  const cookieStore = await cookies()
  cookieStore.set('garten_auth', 'true', {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: true,
    httpOnly: true,
  })
  cookieStore.set('garten_name', gardenName, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
  })
  cookieStore.set('garten_id', gardenId!, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    secure: true,
    httpOnly: false,
  })

  redirect('/')
}
