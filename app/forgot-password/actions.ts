'use server'

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { sendResetRequestEmail } from '@/lib/email'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type ForgotState =
  | { ok: true }
  | { error: 'server' }
  | undefined

// Poka-yoke window. A token issued within this window is reused on re-submits
// instead of being overwritten, and no new email is sent. Kills the
// "multiple emails, user clicked the older one, token invalid" failure mode.
const RESET_DEDUP_WINDOW_MS = 10 * 60 * 1000
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

// Always returns generic "ok" so this endpoint doesn't leak which garden
// names exist. If the name isn't known, we just skip the write/email.
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const gardenName = String(formData.get('gardenName') ?? '').trim()
  if (!gardenName) return { ok: true }

  try {
    const supabase = adminClient()
    const { data: garden } = await supabase
      .from('gardens')
      .select('id, owner_name, reset_token, reset_expires_at')
      .eq('owner_name', gardenName)
      .maybeSingle()

    if (garden) {
      const nowMs = Date.now()
      const expMs = garden.reset_expires_at
        ? new Date(garden.reset_expires_at as string).getTime()
        : 0
      const issuedMs = expMs - RESET_TOKEN_TTL_MS
      const recentlyIssued =
        !!garden.reset_token &&
        expMs > nowMs &&
        nowMs - issuedMs < RESET_DEDUP_WINDOW_MS

      if (!recentlyIssued) {
        const token = randomBytes(32).toString('hex')
        const expires = new Date(nowMs + RESET_TOKEN_TTL_MS).toISOString()
        const { error } = await supabase
          .from('gardens')
          .update({ reset_token: token, reset_expires_at: expires })
          .eq('id', garden.id)
        if (error) {
          console.error('requestPasswordReset update failed:', error)
          return { error: 'server' }
        }

        const appUrl = process.env.APP_URL || 'http://localhost:3000'
        const confirmUrl = `${appUrl.replace(/\/$/, '')}/admin/reset/${token}`
        await sendResetRequestEmail(garden.owner_name as string, confirmUrl)
      }
      // else: within dedup window — the admin already has a fresh email with
      // a still-valid link. Skip the write and the re-send.
    }
    return { ok: true }
  } catch (err) {
    console.error('requestPasswordReset failed:', err)
    return { error: 'server' }
  }
}
