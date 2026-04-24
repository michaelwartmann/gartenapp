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
      .select('id, owner_name')
      .eq('owner_name', gardenName)
      .maybeSingle()

    if (garden) {
      const token = randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
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
    return { ok: true }
  } catch (err) {
    console.error('requestPasswordReset failed:', err)
    return { error: 'server' }
  }
}
