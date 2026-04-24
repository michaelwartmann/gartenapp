'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { requestPasswordReset, type ForgotState } from './actions'

export default function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const prefilled = searchParams.get('name') ?? ''
  const [state, formAction, pending] = useActionState<ForgotState, FormData>(
    requestPasswordReset,
    undefined
  )

  if (state && 'ok' in state && state.ok) {
    return (
      <div
        className="rounded-xl p-5 text-sm leading-relaxed"
        style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
      >
        ✓ Falls dieser Garten existiert, ist jetzt eine E-Mail an Michael
        raus. Du hörst von ihm, sobald er das Passwort zurückgesetzt hat.
      </div>
    )
  }

  const errorText =
    state && 'error' in state ? 'Etwas ist schiefgelaufen. Bitte nochmal.' : null

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="text"
        name="gardenName"
        defaultValue={prefilled}
        placeholder="Dein Gartenname"
        required
        autoFocus
        autoComplete="off"
        autoCapitalize="words"
        className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none min-h-[56px]"
        style={{ borderColor: '#E8E6DF', color: '#2C2C2A' }}
      />

      {errorText && (
        <p className="text-sm pl-1" style={{ color: '#C17B5C' }}>
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-none disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending ? '…' : 'Zurücksetzung anfragen'}
      </button>
    </form>
  )
}
