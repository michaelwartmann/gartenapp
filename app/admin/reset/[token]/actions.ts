'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export type ConfirmState =
  | { ok: true; gardenName: string }
  | { error: 'invalid' | 'expired' | 'server' }
  | undefined

export async function confirmPasswordReset(
  _prev: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const token = String(formData.get('token') ?? '').trim()
  if (!token) return { error: 'invalid' }

  try {
    const supabase = adminClient()
    const { data: garden } = await supabase
      .from('gardens')
      .select('id, owner_name, reset_expires_at')
      .eq('reset_token', token)
      .maybeSingle()

    if (!garden) return { error: 'invalid' }

    const expires = garden.reset_expires_at
      ? new Date(garden.reset_expires_at as string).getTime()
      : 0
    if (!expires || expires < Date.now()) {
      return { error: 'expired' }
    }

    const { error } = await supabase
      .from('gardens')
      .update({
        password_hash: null,
        reset_token: null,
        reset_expires_at: null,
      })
      .eq('id', garden.id)
    if (error) {
      console.error('confirmPasswordReset update failed:', error)
      return { error: 'server' }
    }

    return { ok: true, gardenName: garden.owner_name as string }
  } catch (err) {
    console.error('confirmPasswordReset failed:', err)
    return { error: 'server' }
  }
}
