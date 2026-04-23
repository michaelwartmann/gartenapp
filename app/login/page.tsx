'use client'

import { useActionState, useEffect, useState } from 'react'
import { loginAction, type LoginState } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined
  )
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (state?.error) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 600)
      return () => clearTimeout(t)
    }
  }, [state])

  const hasError = !!state?.error

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-8"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className={`w-full max-w-sm ${shake ? 'animate-shake' : ''}`}>
        <form action={formAction} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-medium" style={{ color: '#2C2C2A' }}>
              🌱 Gartenapp
            </h1>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              name="gardenName"
              placeholder="Gartenname (z.B. Mein Garten)"
              className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none focus:border-opacity-100 min-h-[56px]"
              style={{
                borderColor: hasError ? '#C17B5C' : '#E8E6DF',
                color: '#2C2C2A',
              }}
              autoFocus
              autoComplete="off"
            />

            <input
              type="password"
              name="password"
              placeholder="Passwort eingeben"
              className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none focus:border-opacity-100 min-h-[56px]"
              style={{
                borderColor: hasError ? '#C17B5C' : '#E8E6DF',
                color: '#2C2C2A',
              }}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-4 px-6 rounded-xl text-white font-medium text-lg hover:opacity-90 transition-opacity min-h-[56px] touch-none disabled:opacity-60"
            style={{ backgroundColor: '#4A7C59' }}
          >
            {pending ? '...' : 'Anmelden'}
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.6s ease-in-out;
        }
      `}</style>
    </div>
  )
}
