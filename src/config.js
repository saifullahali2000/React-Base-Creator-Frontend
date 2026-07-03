/**
 * Default iframe URL for local dev (must match backend previewRunner PREVIEW_PORT).
 * In production builds, set VITE_PREVIEW_URL if you host a preview app; otherwise empty (no iframe).
 */
export const PREVIEW_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_PREVIEW_URL !== undefined
    ? String(import.meta.env.VITE_PREVIEW_URL)
    : typeof import.meta !== 'undefined' && import.meta.env?.DEV
      ? 'http://localhost:4000'
      : ''

export const ACTIVE_SESSION_KEY = 'rqg_active_session'

/**
 * Backend base URL for API calls. Empty string = same-origin `/api/...` (Vite proxy in dev,
 * Vercel rewrites in full-stack production).
 *
 * Set `VITE_API_BASE_URL` only for split deploy (static frontend + API elsewhere).
 */
export function getApiBaseUrl() {
  if (typeof import.meta === 'undefined') return ''
  const raw = import.meta.env?.VITE_API_BASE_URL
  if (raw === undefined || raw === null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed) return ''
  return trimmed.replace(/\/+$/, '')
}

/** @param {string} path e.g. `/api/generations` */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getApiBaseUrl()
  return base ? `${base}${p}` : p
}
