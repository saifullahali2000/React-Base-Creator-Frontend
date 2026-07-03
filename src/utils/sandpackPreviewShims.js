/** Injected into Sandpack preview — not imported by the host app. */

export function resolvePreviewProxyBase(apiBaseUrl) {
  const trimmed = (apiBaseUrl || '').trim().replace(/\/+$/, '')
  if (trimmed) return `${trimmed}/api/preview-proxy`
  // Sandpack runs on HTTPS; http://localhost is blocked (mixed content). Call APIs directly.
  return ''
}

export function buildPreviewBootstrap(proxyBase) {
  const safeProxy = String(proxyBase).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  return `/**
 * React Base Creator — in-browser preview: real APIs via backend proxy + JWT storage.
 */
const JWT_KEY = 'jwt_token'
const PROXY_BASE = '${safeProxy}'

function persistJwt(token) {
  if (!token) return
  try {
    sessionStorage.setItem(JWT_KEY, token)
  } catch {
    /* ignore */
  }
}

function readJwt() {
  try {
    const stored = sessionStorage.getItem(JWT_KEY)
    return stored || undefined
  } catch {
    return undefined
  }
}

function extractJwtFromBody(data) {
  if (!data || typeof data !== 'object') return undefined
  return (
    data.jwttoken ||
    data.jwt_token ||
    data.token ||
    data.data?.jwttoken ||
    data.data?.jwt_token ||
    data.data?.token
  )
}

function isLoginRequest(url, method) {
  if (method !== 'POST') return false
  try {
    const path = new URL(url, window.location.href).pathname.toLowerCase()
    return /signin|sign-in|login|auth/.test(path)
  } catch {
    return /signin|sign-in|login/i.test(url)
  }
}

function patchAuthHeaders(init) {
  const token = readJwt()
  if (!token) return init

  const headers = new Headers(init.headers || {})
  const auth = headers.get('Authorization') || headers.get('authorization') || ''

  if (
    auth === 'Bearer undefined' ||
    auth === 'Bearer null' ||
    auth === 'undefined' ||
    auth === 'null' ||
    auth === 'Bearer '
  ) {
    if (auth.startsWith('Bearer')) {
      headers.set('Authorization', 'Bearer ' + token)
    } else {
      headers.set('Authorization', token)
    }
    return { ...init, headers }
  }

  return init
}

function isExternalHttp(url) {
  try {
    const u = new URL(url, window.location.href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.origin !== window.location.origin
  } catch {
    return false
  }
}

function proxiedUrl(url) {
  return PROXY_BASE + '?url=' + encodeURIComponent(url)
}

function shouldProxy(url) {
  if (!PROXY_BASE || !isExternalHttp(url)) return false
  try {
    const proxy = new URL(PROXY_BASE, window.location.href)
    if (window.location.protocol === 'https:' && proxy.protocol === 'http:') return false
  } catch {
    return false
  }
  return true
}

function postToHost(payload) {
  try {
    const msg = { source: 'rqg-preview', ...payload }
    window.parent.postMessage(msg, '*')
    if (window.top && window.top !== window) window.top.postMessage(msg, '*')
  } catch {
    /* ignore */
  }
}

function collectStorage() {
  const sessionStorage = {}
  const localStorage = {}
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i)
      if (k) sessionStorage[k] = window.sessionStorage.getItem(k)
    }
  } catch {
    /* ignore */
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k) localStorage[k] = window.localStorage.getItem(k)
    }
  } catch {
    /* ignore */
  }
  return {
    sessionStorage,
    localStorage,
    cookies: typeof document !== 'undefined' ? document.cookie : '',
  }
}

function broadcastStorage() {
  postToHost({ type: 'storage', ...collectStorage() })
}

if (typeof window !== 'undefined' && !window.__RQG_PREVIEW__) {
  window.__RQG_PREVIEW__ = true
  broadcastStorage()
  setInterval(broadcastStorage, 2500)

  window.addEventListener('error', (ev) => {
    postToHost({
      type: 'runtime-error',
      message: ev.message || 'Script error',
      filename: ev.filename || '',
      lineno: ev.lineno || 0,
    })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason
    postToHost({
      type: 'runtime-error',
      message: reason?.message || String(reason),
      filename: 'promise',
      lineno: 0,
    })
  })

  function formatConsoleArg(arg) {
    if (typeof arg === 'string') return arg
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }

  ;['log', 'info', 'warn', 'error', 'debug'].forEach((level) => {
    const original = console[level]
    console[level] = function (...args) {
      const message = args.map(formatConsoleArg).join(' ')
      const isRouterFutureWarn =
        level === 'warn' && /React Router Future Flag Warning/i.test(message)
      if (!isRouterFutureWarn && typeof original === 'function') original.apply(console, args)
      if (isRouterFutureWarn) return
      postToHost({
        type: 'console',
        level,
        message,
        time: Date.now(),
      })
    }
  })

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' ? input : input.url)
    const method = String(init.method || 'GET').toUpperCase()
    const patchedInit = patchAuthHeaders(init)
    const useProxy = shouldProxy(url)
    const requestUrl = useProxy ? proxiedUrl(url) : input
    const reqId = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8)
    const started = performance.now()

    postToHost({ type: 'network-start', id: reqId, url, method, proxied: useProxy })

    try {
      const response = await realFetch(requestUrl, patchedInit)
      let responsePreview = ''
      try {
        responsePreview = (await response.clone().text()).slice(0, 600)
      } catch {
        /* ignore */
      }

      postToHost({
        type: 'network-end',
        id: reqId,
        url,
        method,
        proxied: useProxy,
        status: response.status,
        ok: response.ok,
        durationMs: Math.round(performance.now() - started),
        responsePreview,
      })

      if (isLoginRequest(url, method) && response.ok) {
        try {
          const data = await response.clone().json()
          const token = extractJwtFromBody(data)
          if (token) {
            persistJwt(token)
            broadcastStorage()
          }
        } catch {
          /* ignore */
        }
      }

      return response
    } catch (err) {
      postToHost({
        type: 'network-end',
        id: reqId,
        url,
        method,
        proxied: useProxy,
        error: err?.message || 'Network request failed',
        durationMs: Math.round(performance.now() - started),
      })
      throw err
    }
  }
}
`
}

export const PREVIEW_BOOTSTRAP_CODE = buildPreviewBootstrap(resolvePreviewProxyBase(''))

export const PREVIEW_COOKIE_SHIM_CODE = `/**
 * js-cookie shim: sessionStorage-first (reliable in Sandpack iframes).
 */
const JWT_KEY = 'jwt_token'

function readCookie(name) {
  try {
    const stored = sessionStorage.getItem(name)
    if (stored !== null) return stored
  } catch {
    /* ignore */
  }
  const parts = document.cookie ? document.cookie.split(';') : []
  const prefix = name + '='
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length))
    }
  }
  return undefined
}

function writeCookie(name, value, days = 30) {
  const str = value === undefined ? '' : String(value)
  try {
    sessionStorage.setItem(name, str)
  } catch {
    /* ignore */
  }
  const maxAge = Math.floor(days * 86400)
  document.cookie =
    encodeURIComponent(name) +
    '=' +
    encodeURIComponent(str) +
    '; path=/; max-age=' +
    maxAge +
    '; SameSite=Lax'
}

function removeCookie(name) {
  try {
    sessionStorage.removeItem(name)
  } catch {
    /* ignore */
  }
  document.cookie = encodeURIComponent(name) + '=; path=/; max-age=0; SameSite=Lax'
}

const api = {
  get(name) {
    return readCookie(name)
  },
  set(name, value, options = {}) {
    const days = typeof options.expires === 'number' ? options.expires : 30
    writeCookie(name, value, days)
    return value === undefined ? '' : String(value)
  },
  remove(name) {
    removeCookie(name)
  },
  withAttributes() {
    return api
  },
  withConverter() {
    return api
  },
}

export default api
`

const BOOTSTRAP_IMPORT = "import './__rqgPreviewBootstrap.js'\n"
const MAIN_ENTRY = ['/src/main.jsx', '/src/main.js', '/src/main.tsx']
const JS_COOKIE_IMPORT = "from '/src/__rqgPreviewCookieShim.js'"

/** Redirect js-cookie to the in-preview shim without a custom vite.config (avoids nodebox temp-file errors). */
export function patchJsCookieImports(source) {
  if (!source || typeof source !== 'string' || !/js-cookie/.test(source)) return source
  return source.replace(/from\s+['"]js-cookie['"]/g, JS_COOKIE_IMPORT)
}

/**
 * @param {Record<string, { code: string; hidden?: boolean }>} files
 * @param {{ apiBaseUrl?: string }} [options]
 */
export function injectSandpackPreviewShims(files, options = {}) {
  const proxyBase = resolvePreviewProxyBase(options.apiBaseUrl)
  files['/src/__rqgPreviewBootstrap.js'] = {
    code: buildPreviewBootstrap(proxyBase),
    hidden: true,
  }
  files['/src/__rqgPreviewCookieShim.js'] = {
    code: PREVIEW_COOKIE_SHIM_CODE,
    hidden: true,
  }

  for (const entry of MAIN_ENTRY) {
    const file = files[entry]
    if (!file?.code || file.code.includes('__rqgPreviewBootstrap')) continue
    files[entry] = { ...file, code: BOOTSTRAP_IMPORT + file.code }
  }

  for (const [path, file] of Object.entries(files)) {
    if (!file?.code || !/\.(jsx|tsx|js)$/i.test(path)) continue
    const next = patchJsCookieImports(file.code)
    if (next !== file.code) files[path] = { ...file, code: next }
  }

  stripSandpackViteConfig(files)
}

/** No custom vite.config in Sandpack — template defaults avoid vite.config.js.timestamp ENOENT races. */
function stripSandpackViteConfig(files) {
  delete files['/vite.config.js']
  delete files['/vite.config.ts']
  delete files['/vite.config.mjs']
}
