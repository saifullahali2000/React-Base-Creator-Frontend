import { useEffect, useState } from 'react'
import { apiUrl, getApiBaseUrl } from '../../config.js'
import './index.css'

function resolveConnectionMode() {
  const base = getApiBaseUrl()
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  const proxyTarget = isDev ? String(import.meta.env?.VITE_API_PROXY_TARGET || '').trim() : ''

  if (base) {
    try {
      const host = new URL(base).hostname.toLowerCase()
      if (host.includes('onrender.com')) return 'Deployed backend'
      if (host.includes('vercel.app')) return 'Deployed backend'
      if (host === 'localhost' || host === '127.0.0.1') return 'Local backend'
      return 'Remote backend'
    } catch {
      return 'Remote backend'
    }
  }

  if (proxyTarget) {
    try {
      const host = new URL(proxyTarget).hostname.toLowerCase()
      if (host === 'localhost' || host === '127.0.0.1') return 'Local backend (dev proxy)'
      return 'Remote backend (dev proxy)'
    } catch {
      return 'Dev proxy'
    }
  }

  return 'Same-origin API'
}

export default function ApiConnectionBanner() {
  const [state, setState] = useState({ loading: true, ok: false, detail: '' })

  const healthUrl = apiUrl('/api/health')
  const modeLabel = resolveConnectionMode()

  useEffect(() => {
    let cancelled = false
    async function check() {
      setState({ loading: true, ok: false, detail: '' })
      try {
        const res = await fetch(healthUrl, { cache: 'no-store' })
        const text = await res.text()
        if (cancelled) return
        if (res.ok && text.includes('"ok"')) {
          setState({ loading: false, ok: true, detail: 'Connected — ready to generate' })
          return
        }
        if (/FUNCTION_INVOCATION_FAILED|INTERNAL_SERVER_ERROR/i.test(text)) {
          setState({
            loading: false,
            ok: false,
            detail: 'Backend error (500). Redeploy the API service and try again.',
          })
          return
        }
        if (res.status === 504) {
          setState({
            loading: false,
            ok: false,
            detail: 'Backend timed out (504). Wait a moment and retry — free tiers can be slow on first request.',
          })
          return
        }
        setState({
          loading: false,
          ok: false,
          detail: `Backend unavailable (${res.status}). Check that the API service is running.`,
        })
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            ok: false,
            detail:
              err.message === 'Failed to fetch'
                ? 'Cannot reach the backend. Check your connection or API configuration.'
                : err.message,
          })
        }
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [healthUrl])

  return (
    <div
      className={`api-conn ${state.loading ? 'api-conn--loading' : state.ok ? 'api-conn--ok' : 'api-conn--err'}`}
      role="status"
    >
      <span className="api-conn-dot" aria-hidden />
      <span className="api-conn-text">
        <span className="api-conn-mode">{modeLabel}</span>
        {state.loading ? ' — Checking connection…' : ` — ${state.detail}`}
      </span>
    </div>
  )
}
