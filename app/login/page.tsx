'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [gardenName, setGardenName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = gardenName.trim()
    if (!trimmedName || !password) {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 600)
      return
    }

    if (password === 'Garten2026') {
      const safeName = encodeURIComponent(trimmedName)
      // Persistent cookies (1 year). garten_auth gates access; garten_name
      // is identity used by the GardenChip and (later) per-garden data.
      document.cookie = 'garten_auth=true; path=/; max-age=31536000; SameSite=Lax; Secure'
      document.cookie = `garten_name=${safeName}; path=/; max-age=31536000; SameSite=Lax; Secure`
      router.push('/')
    } else {
      setError(true)
      setShake(true)
      setPassword('')
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8" style={{ backgroundColor: '#FAFAF7' }}>
      <div className={`w-full max-w-sm ${shake ? 'animate-shake' : ''}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-medium" style={{ color: '#2C2C2A' }}>
              🌱 Gartenapp
            </h1>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={gardenName}
              onChange={(e) => setGardenName(e.target.value)}
              placeholder="Gartenname (z.B. Mein Garten)"
              className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none focus:border-opacity-100 min-h-[56px]"
              style={{
                borderColor: error ? '#C17B5C' : '#E8E6DF',
                color: '#2C2C2A'
              }}
              autoFocus
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben"
              className="w-full px-6 py-4 rounded-xl border-2 bg-white text-lg focus:outline-none focus:border-opacity-100 min-h-[56px]"
              style={{
                borderColor: error ? '#C17B5C' : '#E8E6DF',
                color: '#2C2C2A'
              }}
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-xl text-white font-medium text-lg hover:opacity-90 transition-opacity min-h-[56px] touch-none"
            style={{ backgroundColor: '#4A7C59' }}
          >
            Anmelden
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
