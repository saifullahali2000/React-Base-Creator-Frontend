import { useEffect, useState } from 'react'
import { apiUrl, getApiBaseUrl } from '../../config.js'
import './index.css'

export default function ApiConnectionBanner() {
  const [state, setState] = useState({ loading: true, ok: false, detail: '' })

  const base = getApiBaseUrl()
  const healthUrl = apiUrl('/api/health')
  const proxyTarget =
    typeof import.meta !== 'undefined' && import.meta.env?.DEV
      ? String(import.meta.env.VITE_API_PROXY_TARGET || '').trim()
      : ''
  const label = base || (proxyTarget ? `dev proxy → ${proxyTarget}` : '(same origin)')

  useEffect(() => {
    let cancelled = false
    async function check() {
      setState({ loading: true, ok: false, detail: '' })
      try {
        const res = await fetch(healthUrl, { cache: 'no-store' })
        const text = await res.text()
        if (cancelled) return
        if (res.ok && text.includes('"ok"')) {
          setState({ loading: false, ok: true, detail: 'API reachable' })
          return
        }
        if (/FUNCTION_INVOCATION_FAILED|INTERNAL_SERVER_ERROR/i.test(text)) {
          setState({
            loading: false,
            ok: false,
            detail: 'API function crashed on the server (500). Redeploy backend with latest code.',
          })
          return
        }
        if (res.status === 504) {
          setState({
            loading: false,
            ok: false,
            detail:
              'Gateway timeout (504) — Vercel cold start or slow boot. Wait and retry, redeploy backend with latest api/health.mjs, or use VITE_API_PROXY_TARGET=http://localhost:3001 locally.',
          })
          return
        }
        setState({
          loading: false,
          ok: false,
          detail: `Upstream API returned ${res.status} (Vite proxied to ${proxyTarget || 'backend'}). Check the backend deploy, or set VITE_API_PROXY_TARGET=http://localhost:3001 and run cd backend && npm start.`,
        })
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            ok: false,
            detail: err.message === 'Failed to fetch'
              ? 'Cannot reach API — restart npm run dev after .env changes, or check VITE_API_PROXY_TARGET.'
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
        API <code className="api-conn-code">{label}</code>
        {state.loading ? ' — checking…' : ` — ${state.detail}`}
      </span>
    </div>
  )
}
