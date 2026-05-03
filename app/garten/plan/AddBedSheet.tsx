'use client'

import AddBedForm from './AddBedForm'

type Props = {
  /** Stage 11B — when AddBedForm fires onAdded, the parent uses this to
   *  auto-select the new bed. Sheet also closes itself. */
  onAdded: (bedId: string) => void
  onClose: () => void
}

/**
 * Stage 11B — bottom-sheet wrapper around AddBedForm. Pattern matches
 * BackgroundPicker / HarvestSheet so the user gets a consistent modal.
 * AddBedForm itself is unchanged — only the host moves from "always
 * inline under the canvas" to "modal triggered by + Beet header button".
 */
export default function AddBedSheet({ onAdded, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#FAFAF7' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
            + Beet anlegen
          </h2>
          <button
            onClick={onClose}
            className="text-sm px-2 py-1 touch-manipulation"
            style={{ color: '#888780' }}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <AddBedForm
          startOpen
          hideCollapse
          onAdded={(bedId) => {
            onAdded(bedId)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
