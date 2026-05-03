import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { listBedsForGarden } from './actions'
import EditorClient from './editor/EditorClient'
import AddBedForm from './AddBedForm'

export const dynamic = 'force-dynamic'

export default async function GartenPlanPage() {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) redirect('/login')

  const views = await listBedsForGarden()

  if (views.length === 0) {
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

          <AddBedForm />
        </div>
      </div>
    )
  }

  return (
    <>
      <EditorClient views={views} />
      <div
        className="px-4 pb-12"
        style={{ backgroundColor: '#FAFAF7' }}
      >
        <div className="w-full max-w-md mx-auto">
          <AddBedForm />
        </div>
      </div>
    </>
  )
}
