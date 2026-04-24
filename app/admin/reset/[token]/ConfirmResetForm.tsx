'use client'

import { useActionState } from 'react'
import { confirmPasswordReset, type ConfirmState } from './actions'

export default function ConfirmResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(
    confirmPasswordReset,
    undefined
  )

  if (state && 'ok' in state && state.ok) {
    return (
      <div
        className="rounded-xl p-5 text-sm leading-relaxed text-center"
        style={{ backgroundColor: '#F0EDE4', color: '#4A7C59' }}
      >
        ✓ Passwort für <strong>{state.gardenName}</strong> zurückgesetzt.
        Bitte die Person kurz informieren, dass sie sich jetzt mit einem
        neuen Passwort einloggen kann.
      </div>
    )
  }

  const errorText =
    state && 'error' in state
      ? state.error === 'expired'
        ? 'Link ist abgelaufen.'
        : state.error === 'invalid'
          ? 'Link ist ungültig.'
          : 'Etwas ist schiefgelaufen.'
      : null

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {errorText && (
        <p
          className="text-sm text-center"
          style={{ color: '#C17B5C' }}
        >
          {errorText}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-none disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending ? '…' : 'Ja, zurücksetzen'}
      </button>
    </form>
  )
}
