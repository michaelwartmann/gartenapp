import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { listBedsForGarden } from './actions'
import BedCard from './BedCard'
import AddBedForm from './AddBedForm'

export const dynamic = 'force-dynamic'

export default async function GartenPlanPage() {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) redirect('/login')

  const beds = await listBedsForGarden()

  return (
    <div
      className="min-h-screen px-4 py-6 pb-12"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium"
            style={{ color: '#4A7C59' }}
          >
            ← Mein Garten
          </Link>
          <h1 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            Garten-Plan
          </h1>
          <span className="w-16" />
        </header>

        {beds.length === 0 ? (
          <div className="text-center py-8 px-6">
            <div className="text-5xl mb-4">🗺️</div>
            <h2
              className="text-lg font-medium mb-2"
              style={{ color: '#2C2C2A' }}
            >
              Noch keine Beete.
            </h2>
            <p className="text-sm mb-6" style={{ color: '#888780' }}>
              Lege ein Hochbeet, einen Topf oder ein Beet an, um Pflanzen
              zuzuordnen und die Fruchtfolge im Blick zu behalten.
            </p>
          </div>
        ) : (
          <>
            <Link
              href="/garten/plan/editor"
              className="block w-full mb-4 px-4 py-3 rounded-xl text-center text-sm font-medium border touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
              style={{
                color: '#4A7C59',
                borderColor: '#C9DCC9',
                backgroundColor: '#F0F5F0',
              }}
            >
              🗺️ Skizze bearbeiten
            </Link>
            <div className="space-y-4 mb-6">
              {beds.map((view) => (
                <BedCard key={view.bed.id} view={view} />
              ))}
            </div>
          </>
        )}

        <AddBedForm />
      </div>
    </div>
  )
}
