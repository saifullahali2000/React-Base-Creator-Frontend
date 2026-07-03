import { useCallback, useEffect, useRef, useState } from 'react'

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

/**
 * Browser speech-to-text (Web Speech API). Chrome / Edge supported; Firefox/Safari vary.
 * Calls onTranscriptUpdate with committed (final) + interim text on every partial result.
 */
export function useSpeechToText({ onTranscriptUpdate, onSessionStart, onSessionEnd, lang }) {
  const [supported] = useState(() => Boolean(getSpeechRecognition()))
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const callbacksRef = useRef({ onTranscriptUpdate, onSessionStart, onSessionEnd })
  callbacksRef.current = { onTranscriptUpdate, onSessionStart, onSessionEnd }

  const stop = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Speech input is not supported in this browser. Try Chrome or Edge.')
      return
    }

    stop()
    setError('')
    callbacksRef.current.onSessionStart?.()

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang || navigator.language || 'en-US'

    recognition.onresult = (event) => {
      let committed = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) committed += transcript
        else interim += transcript
      }
      callbacksRef.current.onTranscriptUpdate?.({ committed, interim })
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      setError(event.error === 'not-allowed' ? 'Microphone permission denied.' : `Speech error: ${event.error}`)
      stop()
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      callbacksRef.current.onSessionEnd?.()
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setListening(true)
    } catch (e) {
      setError(e.message || 'Could not start speech recognition.')
      stop()
    }
  }, [lang, stop])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  useEffect(() => () => stop(), [stop])

  return { supported, listening, error, toggle, stop }
}
