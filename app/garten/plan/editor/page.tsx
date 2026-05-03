import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Stage 8: editor was promoted to /garten/plan. This route stays as a
 * silent redirect for old bookmarks. Remove ~6 weeks after Stage 8 ships.
 */
export default function GartenPlanEditorPage() {
  redirect('/garten/plan')
}
