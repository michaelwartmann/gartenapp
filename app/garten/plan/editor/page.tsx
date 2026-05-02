import { redirect } from 'next/navigation'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { listBedsForGarden } from '../actions'
import EditorClient from './EditorClient'

export const dynamic = 'force-dynamic'

export default async function GartenPlanEditorPage() {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) redirect('/login')

  const views = await listBedsForGarden()
  const beds = views.map((v) => v.bed)

  if (beds.length === 0) {
    redirect('/garten/plan')
  }

  return <EditorClient beds={beds} />
}
