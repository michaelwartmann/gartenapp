'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type LoginState = { error?: 'invalid' } | undefined

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

  redirect('/')
}
