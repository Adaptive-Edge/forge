'use client'

import { useState } from 'react'
import { NewBriefModal } from './new-brief-modal'

export function NewBriefButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <span>+</span>
        <span>New Brief</span>
      </button>
      {isOpen && <NewBriefModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
