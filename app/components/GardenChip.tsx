'use client'

import { useEffect, useState } from 'react'

export default function GardenChip() {
  const [name, setName] = useState<string | null>(null)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)garten_name=([^;]+)/)
    if (match) {
      try {
        setName(decodeURIComponent(match[1]))
      } catch {
        setName(match[1])
      }
    }
  }, [])

  if (!name) return null

  return (
    <div
      className="fixed right-4 z-10 px-3 py-1 rounded-full text-xs font-medium pointer-events-none shadow-sm"
      style={{
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        backgroundColor: '#FFFFFF',
        color: '#888780',
        border: '1px solid #E8E6DF',
      }}
    >
      🌿 {name}
    </div>
  )
}
