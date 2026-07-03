import { useState, useRef, useEffect, useCallback } from 'react'
import ClientPreview from '../ClientPreview/index.jsx'
import { isBackendHostedPreviewUrl } from '../../utils/previewUtils.js'
import { apiUrl } from '../../config.js'
import './index.css'

const PREVIEW_BOOT_ATTEMPTS = 12
const PREVIEW_BOOT_INTERVAL_MS = 2000

function normalizeBaseUrl(url) {
  if (!url || typeof url !== 'string') return ''
  try {
    const u = new URL(url)
    return u.origin + '/'
  } catch {
    return url.endsWith('/') ? url : `${url}/`
  }
}

function hasSolutionFiles(solution) {
  return solution && typeof solution === 'object' && Object.keys(solution).length > 0
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function PreviewPanel({
  previewUrl,
  solution,
  isGenerating,
  reloadKey = 0,
  hasGeneratedOutput = false,
}) {
  const [loaded, setLoaded] = useState(false)
  /** checking = waiting for Vite; ready = use iframe; failed = Sandpack fallback */
  const [previewBootState, setPreviewBootState] = useState('checking')
  const iframeRef = useRef(null)
  const urlInputRef = useRef('')
  const [urlInput, setUrlInput] = useState('')
  const [iframeSrc, setIframeSrc] = useState('')
  urlInputRef.current = urlInput

  const hasSolution = hasSolutionFiles(solution)
  const wantsBackendPreview =
    isBackendHostedPreviewUrl(previewUrl) && previewBootState !== 'failed'
  const hasBackendPreview = wantsBackendPreview && previewBootState === 'ready'
  const isBootingBackend = wantsBackendPreview && previewBootState === 'checking'
  const hasClientPreview = hasSolution && previewBootState === 'failed'

  useEffect(() => {
    if (!previewUrl || !isBackendHostedPreviewUrl(previewUrl)) {
      setPreviewBootState('failed')
      return
    }

    setPreviewBootState('checking')
    let cancelled = false

    void (async () => {
      for (let attempt = 0; attempt < PREVIEW_BOOT_ATTEMPTS && !cancelled; attempt++) {
        try {
          if (attempt === 0) {
            await fetch(apiUrl('/api/preview/ensure'), { method: 'POST' })
          }
          const res = await fetch(apiUrl('/api/preview/status'), { cache: 'no-store' })
          if (res.ok) {
            const data = await res.json()
            if (data?.running) {
              if (!cancelled) setPreviewBootState('ready')
              return
            }
          }
        } catch {
          /* retry */
        }
        if (attempt < PREVIEW_BOOT_ATTEMPTS - 1) {
          await wait(PREVIEW_BOOT_INTERVAL_MS)
        }
      }
      if (!cancelled) setPreviewBootState('failed')
    })()

    return () => {
      cancelled = true
    }
  }, [previewUrl, reloadKey])

  useEffect(() => {
    if (!hasBackendPreview || !previewUrl) return
    const base = normalizeBaseUrl(previewUrl)
    setIframeSrc(base)
    setUrlInput(base)
  }, [hasBackendPreview, previewUrl])

  const allowedOrigin = hasBackendPreview && previewUrl ? new URL(previewUrl).origin : ''

  useEffect(() => {
    const onMessage = (ev) => {
      if (!allowedOrigin || ev.origin !== allowedOrigin) return
      const frame = iframeRef.current
      if (!frame || ev.source !== frame.contentWindow) return
      if (ev.data?.type === 'RQG_PREVIEW_LOCATION' && typeof ev.data.href === 'string') {
        setUrlInput(ev.data.href)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [allowedOrigin])

  useEffect(() => {
    if (!hasBackendPreview || !previewUrl) return
    try {
      const base = new URL(previewUrl)
      const raw = urlInputRef.current
      const next = new URL((raw && raw.trim()) || base.href, base)
      if (next.origin !== base.origin) return
      setIframeSrc(next.href)
    } catch {
      /* ignore */
    }
  }, [hasBackendPreview, reloadKey, previewUrl])

  useEffect(() => {
    setLoaded(false)
  }, [reloadKey])

  useEffect(() => {
    if (!hasBackendPreview || !previewUrl) return
    const timer = setTimeout(() => {
      if (!loaded) setPreviewBootState('failed')
    }, 20000)
    return () => clearTimeout(timer)
  }, [hasBackendPreview, previewUrl, reloadKey, loaded])

  const navigateIframe = useCallback(
    (href) => {
      if (!hasBackendPreview || !previewUrl || !href) return
      try {
        const base = new URL(previewUrl)
        const next = new URL(href, base)
        if (next.origin !== base.origin) return
        const target = next.href
        setLoaded(false)
        setIframeSrc(target)
        setUrlInput(target)
        if (iframeRef.current) {
          iframeRef.current.src = target
        }
      } catch {
        /* invalid URL */
      }
    },
    [hasBackendPreview, previewUrl],
  )

  const handleIframeError = useCallback(() => {
    setPreviewBootState('failed')
  }, [])

  const handleGo = useCallback(() => {
    navigateIframe(urlInput.trim())
  }, [navigateIframe, urlInput])

  const handleReload = () => {
    const frame = iframeRef.current
    if (frame && hasBackendPreview && previewUrl) {
      try {
        const base = new URL(previewUrl)
        const next = new URL(urlInput.trim() || base.href, base)
        if (next.origin === base.origin) {
          frame.src = next.href
          setIframeSrc(next.href)
        } else {
          const fallback = normalizeBaseUrl(previewUrl)
          frame.src = fallback
          setIframeSrc(fallback)
        }
      } catch {
        const fb = normalizeBaseUrl(previewUrl)
        frame.src = fb
        setIframeSrc(fb)
      }
      setLoaded(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleGo()
    }
  }

  const showPlaceholder = !isGenerating && !hasBackendPreview && !hasClientPreview && !isBootingBackend

  return (
    <div className="preview-panel">
      {hasBackendPreview && (
        <div className="preview-toolbar preview-toolbar--browser">
          <button type="button" className="preview-chrome-btn" onClick={handleReload} title="Reload">
            ↻
          </button>
          <input
            type="text"
            className="preview-address-input"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="http://localhost:4000/…"
            spellCheck={false}
            aria-label="Preview URL"
            autoComplete="off"
          />
          <button type="button" className="preview-go-btn" onClick={handleGo} title="Go to URL">
            Go
          </button>
        </div>
      )}

      {hasClientPreview && !isGenerating ? (
        <div className="preview-body preview-body--sandpack-slot">
          <ClientPreview solution={solution} reloadKey={reloadKey} />
        </div>
      ) : (
        <div className="preview-body">
          {showPlaceholder && (
            <div className="preview-placeholder">
              <div className="pp-icon">🖥</div>
              {hasGeneratedOutput ? (
                <>
                  <p className="pp-title">No preview files</p>
                  <p className="pp-sub">Generate a question to load the live preview here.</p>
                </>
              ) : (
                <>
                  <p className="pp-title">No Preview Yet</p>
                  <p className="pp-sub">Generate a question to see the live app here.</p>
                </>
              )}
            </div>
          )}

          {isGenerating && (
            <div className="preview-placeholder">
              <div className="pp-spinner" />
              <p className="pp-title">Generating...</p>
              <p className="pp-sub">The preview will appear automatically when done.</p>
            </div>
          )}

          {isBootingBackend && !isGenerating && (
            <div className="preview-placeholder">
              <div className="pp-spinner" />
              <p className="pp-title">Starting live preview…</p>
              <p className="pp-sub">
                Waiting for Vite on <code>{previewUrl || 'localhost:4000'}</code>. Ensure{' '}
                <code>npm start</code> is running in <code>backend/</code>.
              </p>
            </div>
          )}

          {hasBackendPreview && !isGenerating && iframeSrc && (
            <>
              {!loaded && (
                <div className="preview-loading">
                  <div className="pp-spinner" />
                  <p>Loading preview...</p>
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={String(reloadKey)}
                src={iframeSrc}
                className="preview-iframe"
                style={{ opacity: loaded ? 1 : 0 }}
                onLoad={() => setLoaded(true)}
                onError={handleIframeError}
                title="App Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
