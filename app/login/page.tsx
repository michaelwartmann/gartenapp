'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  checkGardenName,
  loginWithPassword,
  setupPassword,
  type LoginState,
} from './actions'

type Stage =
  | { kind: 'name' }
  | { kind: 'password'; gardenName: string; needsSetup: boolean }

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'name' })
  const [nameError, setNameError] = useState<string | null>(null)
  const [checking, startChecking] = useTransition()
  const [name, setName] = useState('')

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-8"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-medium" style={{ color: '#2C2C2A' }}>
            🌱 Gartenapp
          </h1>
        </div>

        {stage.kind === 'name' ? (
          <NameStage
            name={name}
            setName={setName}
            checking={checking}
            error={nameError}
            onSubmit={(value) => {
              setNameError(null)
              startChecking(async () => {
                const result = await checkGardenName(value)
                if (!result.found) {
                  setNameError('Diesen Garten gibt es nicht.')
                  return
                }
                setStage({
                  kind: 'password',
                  gardenName: value,
                  needsSetup: result.needsSetup,
                })
              })
            }}
          />
        ) : (
          <PasswordStage
            gardenName={stage.gardenName}
            needsSetup={stage.needsSetup}
            onBack={() => {
              setStage({ kind: 'name' })
              setNameError(null)
            }}
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.6s ease-in-out; }
      `}</style>
    </div>
  )
}

function NameStage(props: {
  name: string
  setName: (v: string) => void
  checking: boolean
  error: string | null
  onSubmit: (value: string) => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const value = props.name.trim()
        if (!value) return
        props.onSubmit(value)
      }}
      className={`space-y-5 ${props.error ? 'animate-shake' : ''}`}
      key={props.error || ''}
    >
      <div className="space-y-2">
        <label
          htmlFor="gardenName"
          className="block text-xs font-medium uppercase tracking-wide"
          style={{ color: '#888780' }}
        >
          Dein Garten
        </label>
        <input
          id="gardenName"
          type="text"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="Gartenname"
          className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none min-h-[56px]"
          style={{
            borderColor: props.error ? '#C17B5C' : '#E8E6DF',
            color: '#2C2C2A',
          }}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
        />
        {props.error && (
          <p className="text-sm pl-1" style={{ color: '#C17B5C' }}>
            {props.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={props.checking}
        className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-manipulation disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {props.checking ? '…' : 'Weiter'}
      </button>
    </form>
  )
}

function PasswordStage(props: {
  gardenName: string
  needsSetup: boolean
  onBack: () => void
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    props.needsSetup ? setupPassword : loginWithPassword,
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

  const errorText =
    state?.error === 'wrong-password'
      ? 'Falsches Passwort.'
      : state?.error === 'invalid'
        ? props.needsSetup
          ? 'Passwörter stimmen nicht überein (mindestens 6 Zeichen).'
          : 'Bitte Passwort eingeben.'
        : state?.error === 'already-set'
          ? 'Passwort ist bereits gesetzt — bitte einloggen.'
          : state?.error === 'server'
            ? 'Etwas ist schiefgelaufen.'
            : null

  return (
    <form
      action={formAction}
      className={`space-y-5 ${shake ? 'animate-shake' : ''}`}
    >
      <input type="hidden" name="gardenName" value={props.gardenName} />

      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E6DF' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: '#4A7C59', fontSize: '1.1rem' }}>✓</span>
          <span style={{ color: '#2C2C2A' }}>{props.gardenName}</span>
        </div>
        <button
          type="button"
          onClick={props.onBack}
          className="text-xs underline touch-manipulation"
          style={{ color: '#888780' }}
        >
          ändern
        </button>
      </div>

      {props.needsSetup && (
        <p
          className="text-sm leading-relaxed px-1"
          style={{ color: '#888780' }}
        >
          Erstes Einloggen für <strong>{props.gardenName}</strong> — wähle
          jetzt dein Passwort.
        </p>
      )}

      <div className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder={
            props.needsSetup ? 'Neues Passwort (min. 6 Zeichen)' : 'Passwort'
          }
          className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none min-h-[56px]"
          style={{
            borderColor: state?.error ? '#C17B5C' : '#E8E6DF',
            color: '#2C2C2A',
          }}
          autoFocus
          autoComplete={props.needsSetup ? 'new-password' : 'current-password'}
          minLength={props.needsSetup ? 6 : undefined}
          required
        />
        {props.needsSetup && (
          <input
            type="password"
            name="confirmPassword"
            placeholder="Passwort bestätigen"
            className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none min-h-[56px]"
            style={{
              borderColor: state?.error ? '#C17B5C' : '#E8E6DF',
              color: '#2C2C2A',
            }}
            autoComplete="new-password"
            minLength={6}
            required
          />
        )}
      </div>

      {errorText && (
        <p className="text-sm pl-1" style={{ color: '#C17B5C' }}>
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 rounded-xl text-white font-medium text-lg min-h-[56px] touch-manipulation disabled:opacity-60"
        style={{ backgroundColor: '#4A7C59' }}
      >
        {pending ? '…' : props.needsSetup ? 'Passwort festlegen' : 'Einloggen'}
      </button>

      {!props.needsSetup && (
        <p className="text-center text-sm">
          <Link
            href={`/forgot-password?name=${encodeURIComponent(props.gardenName)}`}
            style={{ color: '#888780' }}
            className="underline"
          >
            Passwort vergessen?
          </Link>
        </p>
      )}
    </form>
  )
}
