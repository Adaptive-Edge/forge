'use client'

import { VoiceBriefButton } from './voice-brief-button'
import type { BriefDefaultValues } from './new-brief-modal'

export function NewBriefButton({
  isOpen,
  onOpen,
  onClose,
}: {
  isOpen: boolean
  onOpen: (values?: BriefDefaultValues) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <VoiceBriefButton
        onBriefReady={(brief) => onOpen(brief)}
      />
      <button
        onClick={() => onOpen()}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <span>+</span>
        <span>New Brief</span>
      </button>
    </div>
  )
}
