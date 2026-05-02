import Link from 'next/link'
import { Suspense } from 'react'
import AddPlantFlow from './AddPlantFlow'

export const dynamic = 'force-dynamic'

export default function AddPlantPage() {
  return (
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: '#FAFAF7' }}>
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/browse"
            className="text-sm font-medium"
            style={{ color: '#4A7C59' }}
          >
            ← Katalog
          </Link>
          <h1
            className="text-base font-medium"
            style={{ color: '#2C2C2A' }}
          >
            Pflanze hinzufügen
          </h1>
          <span className="w-16" />
        </header>

        <p
          className="text-sm mb-6 leading-relaxed"
          style={{ color: '#888780' }}
        >
          Pflanze nicht im Katalog? Füge sie selbst hinzu — den Rest erledigen
          wir mit einer KI.
        </p>

        <Suspense fallback={null}>
          <AddPlantFlow />
        </Suspense>
      </div>
    </div>
  )
}
