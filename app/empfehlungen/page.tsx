import Link from 'next/link'
import RecommendationForm from './RecommendationForm'

export const dynamic = 'force-dynamic'

export default function EmpfehlungenPage() {
  return (
    <div
      className="min-h-screen px-4 py-6 pb-12"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm underline"
            style={{ color: '#888780' }}
          >
            ← Mein Garten
          </Link>
        </header>

        <div className="mb-6 text-center">
          <h1
            className="text-2xl font-medium"
            style={{ color: '#2C2C2A' }}
          >
            🌿 Was kann ich pflanzen?
          </h1>
          <p
            className="text-sm mt-2 leading-relaxed"
            style={{ color: '#888780' }}
          >
            Erzähl, was du gerade überlegst — du bekommst eine ehrliche
            Einschätzung zu deiner Idee plus weitere Vorschläge, die zu
            dir und deinem Garten passen.
          </p>
        </div>

        <RecommendationForm />
      </div>
    </div>
  )
}
