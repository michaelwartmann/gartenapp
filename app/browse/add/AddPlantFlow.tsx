'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddPlantForm from './AddPlantForm'
import AssignBedSheet from '@/app/garten/plan/AssignBedSheet'
import type { CreateResult } from './actions'

type Submitted = Extract<CreateResult, { ok: true }>

export default function AddPlantFlow() {
  const router = useRouter()
  const [submitted, setSubmitted] = useState<Submitted | null>(null)

  const handleSuccess = useCallback((result: Submitted) => {
    setSubmitted(result)
  }, [])

  const handleSheetClose = useCallback(() => {
    if (!submitted) return
    const target = `/plants/${submitted.plantId}${
      submitted.deduped ? '' : '?fresh=1'
    }`
    router.replace(target)
  }, [submitted, router])

  return (
    <>
      <AddPlantForm onSuccess={handleSuccess} />
      {submitted && (
        <AssignBedSheet
          plantId={submitted.plantId}
          plantName={submitted.plantName}
          suitableBedKinds={submitted.suitableBedKinds}
          onClose={handleSheetClose}
        />
      )}
    </>
  )
}
