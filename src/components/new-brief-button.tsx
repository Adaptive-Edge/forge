'use client'

import { useState } from 'react'
import { NewBriefModal, type BriefDefaultValues } from './new-brief-modal'
import { VoiceBriefButton } from './voice-brief-button'

export function NewBriefButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultValues, setDefaultValues] = useState<BriefDefaultValues | undefined>()

  const openModal = (values?: BriefDefaultValues) => {
    setDefaultValues(values)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setDefaultValues(undefined)
  }

  return (
    <div className="flex items-center gap-2">
      <VoiceBriefButton
        onBriefReady={(brief) => openModal(brief)}
      />
      <button
        onClick={() => openModal()}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <span>+</span>
        <span>New Brief</span>
      </button>
      {isOpen && <NewBriefModal onClose={closeModal} defaultValues={defaultValues} />}
    </div>
  )
}
