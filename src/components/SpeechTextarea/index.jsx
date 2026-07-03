import { useCallback, useRef } from 'react'
import { useSpeechToText } from '../../hooks/useSpeechToText.js'

function joinBaseAndSpoken(base, spoken) {
  const trimmed = spoken.trimEnd()
  if (!trimmed) return base
  if (!base.trim()) return trimmed
  if (base.endsWith('\n') || base.endsWith(' ')) return base + trimmed
  return `${base}\n${trimmed}`
}

export default function SpeechTextarea({
  value,
  onChange,
  rows = 9,
  placeholder,
  className = 'gen-textarea',
  id,
  spellCheck = false,
}) {
  const baseRef = useRef('')
  const listeningRef = useRef(false)

  const handleSessionStart = useCallback(() => {
    baseRef.current = value ?? ''
  }, [value])

  const handleTranscript = useCallback(
    ({ committed, interim }) => {
      const spoken = committed + interim
      if (!spoken) return
      onChange(joinBaseAndSpoken(baseRef.current, spoken))
    },
    [onChange],
  )

  const { supported, listening, error, toggle, stop } = useSpeechToText({
    onSessionStart: handleSessionStart,
    onTranscriptUpdate: handleTranscript,
  })

  listeningRef.current = listening

  const handleTextChange = (e) => {
    if (listeningRef.current) stop()
    onChange(e.target.value)
  }

  return (
    <div className={`speech-textarea${listening ? ' speech-textarea--live' : ''}`}>
      <div className="speech-textarea-toolbar">
        <button
          type="button"
          className={`speech-mic-btn${listening ? ' speech-mic-btn--active' : ''}`}
          onClick={toggle}
          disabled={!supported}
          title={
            supported
              ? listening
                ? 'Stop dictation'
                : 'Speak to type — words appear as you talk'
              : 'Speech input not supported in this browser (use Chrome or Edge)'
          }
          aria-pressed={listening}
          aria-label={listening ? 'Stop speech input' : 'Start speech input'}
        >
          <span className="speech-mic-icon" aria-hidden>
            {listening ? '⏹' : '🎤'}
          </span>
          <span>{listening ? 'Stop' : 'Speak'}</span>
        </button>
        {listening && (
          <span className="speech-mic-status">Listening… typing as you speak</span>
        )}
        {!supported && (
          <span className="speech-mic-status speech-mic-status--muted">
            Dictation needs Chrome or Edge
          </span>
        )}
        {error && <span className="speech-mic-status speech-mic-status--error">{error}</span>}
      </div>
      <textarea
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleTextChange}
        rows={rows}
        spellCheck={spellCheck}
      />
    </div>
  )
}
