'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type SharpenedBrief = {
  title: string
  brief: string
  outcome_tier: number
  outcome_type: string
  impact_score: number
  acceptance_criteria: string[]
}

type VoiceState = 'idle' | 'listening' | 'processing'

export function VoiceBriefButton({
  onBriefReady,
}: {
  onBriefReady: (brief: SharpenedBrief) => void
}) {
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const transcriptRef = useRef('')

  useEffect(() => {
    setIsSupported(
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    )
  }, [])

  const startListening = useCallback(() => {
    setError(null)
    transcriptRef.current = ''

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-GB'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript + ' '
        }
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        setError(`Speech error: ${event.error}`)
        setState('idle')
      }
    }

    recognition.onend = () => {
      // Only process if we were listening (not if manually stopped before any speech)
      if (state === 'listening' && transcriptRef.current.trim()) {
        processTranscript(transcriptRef.current.trim())
      }
    }

    recognitionRef.current = recognition
    recognition.start()
    setState('listening')
  }, [state])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    const transcript = transcriptRef.current.trim()
    if (transcript) {
      processTranscript(transcript)
    } else {
      setState('idle')
    }
  }, [])

  const processTranscript = async (transcript: string) => {
    setState('processing')
    try {
      const res = await fetch('/api/sharpen-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to process')
      }

      const brief = await res.json()
      onBriefReady(brief)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed')
    } finally {
      setState('idle')
    }
  }

  const handleClick = () => {
    if (state === 'listening') {
      stopListening()
    } else if (state === 'idle') {
      startListening()
    }
  }

  if (!isSupported) return null

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={state === 'processing'}
        title={
          state === 'idle' ? 'Dictate a brief' :
          state === 'listening' ? 'Stop recording' :
          'Processing...'
        }
        className={`flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-all ${
          state === 'listening'
            ? 'bg-red-600 hover:bg-red-500 animate-pulse'
            : state === 'processing'
            ? 'bg-zinc-700 opacity-50 cursor-wait'
            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white'
        }`}
      >
        {state === 'processing' ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-1 right-0 bg-red-900/90 text-red-200 text-xs px-2 py-1 rounded whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  )
}
