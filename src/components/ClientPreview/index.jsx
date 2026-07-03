import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
  useSandpackNavigation,
  defaultLight,
} from '@codesandbox/sandpack-react'
import ClientDevtools from '../ClientDevtools/index.jsx'
import { buildSandpackFiles } from '../../utils/buildSandpackFiles.js'
import { getApiBaseUrl } from '../../config.js'
import './index.css'

/** Sandpack defaults to 300px height — stretch to fill the preview panel. */
const SANDPACK_PREVIEW_THEME = {
  ...defaultLight,
  layout: {
    ...(defaultLight.layout || {}),
    height: '100%',
    width: '100%',
    headerHeight: '0px',
  },
}

function splitPreviewUrl(url) {
  try {
    const u = new URL(url)
    const path = `${u.pathname}${u.search}${u.hash}` || '/'
    return [u.origin + '/', path]
  } catch {
    const path = url.startsWith('/') ? url : `/${url}`
    return ['', path]
  }
}

function ClientPreviewToolbar({
  previewRef,
  clientId,
  devtoolsOpen,
  onToggleDevtools,
  devtoolsBadge,
}) {
  const [urlInput, setUrlInput] = useState('/')
  const baseUrlRef = useRef('')
  const { listen } = useSandpack()
  const { refresh } = useSandpackNavigation(clientId)

  useEffect(() => {
    if (!clientId) return undefined
    const unsub = listen((message) => {
      if (message.type !== 'urlchange' || typeof message.url !== 'string') return
      const [base] = splitPreviewUrl(message.url)
      baseUrlRef.current = base
      setUrlInput(message.url)
    }, clientId)
    return unsub
  }, [clientId, listen])

  const navigate = useCallback(
    (href) => {
      const client = previewRef.current?.getClient?.()
      const frame = client?.iframe
      if (!frame || !href?.trim()) return

      const raw = href.trim()
      let target = raw
      if (raw.startsWith('/')) {
        try {
          target = new URL(raw, baseUrlRef.current || frame.src).href
        } catch {
          return
        }
      } else if (!/^https?:\/\//i.test(raw)) {
        try {
          target = new URL(`/${raw.replace(/^\//, '')}`, baseUrlRef.current || frame.src).href
        } catch {
          return
        }
      }

      frame.src = target
      setUrlInput(target)
    },
    [previewRef],
  )

  const handleGo = useCallback(() => navigate(urlInput), [navigate, urlInput])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleGo()
    }
  }

  return (
    <div className="preview-toolbar preview-toolbar--browser client-preview-toolbar">
      <button type="button" className="preview-chrome-btn" onClick={refresh} title="Reload">
        ↻
      </button>
      <input
        type="text"
        className="preview-address-input"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="/ or https://…"
        spellCheck={false}
        aria-label="Preview URL"
        autoComplete="off"
      />
      <button type="button" className="preview-go-btn" onClick={handleGo} title="Go to URL">
        Go
      </button>
      <button
        type="button"
        className={`preview-devtools-btn ${devtoolsOpen ? 'preview-devtools-btn--active' : ''}`}
        onClick={onToggleDevtools}
        title={devtoolsOpen ? 'Hide developer tools' : 'Show Console, Network, Application'}
      >
        {devtoolsOpen ? 'Hide devtools' : 'Devtools'}
        {!devtoolsOpen && devtoolsBadge > 0 && (
          <span className="preview-devtools-badge">{devtoolsBadge}</span>
        )}
      </button>
    </div>
  )
}

function SandpackDiagnostics({ onCompileError }) {
  const { sandpack } = useSandpack()

  useEffect(() => {
    if (!sandpack.error) return
    onCompileError?.(String(sandpack.error))
  }, [sandpack.error, onCompileError])

  return null
}

function ClientPreviewFrame({
  networkLog,
  consoleLog,
  storageSnap,
  runtimeErrors,
  devtoolsOpen,
  onToggleDevtools,
  onClearNetwork,
  onClearConsole,
  onClearErrors,
}) {
  const previewRef = useRef(null)
  const [clientId, setClientId] = useState(undefined)

  const attachPreviewRef = useCallback((node) => {
    previewRef.current = node
    setClientId(node?.clientId)
  }, [])

  const devtoolsBadge =
    runtimeErrors.length +
    networkLog.filter((e) => e.error || (e.status && e.status >= 400)).length

  return (
    <div className={`client-preview-stack ${devtoolsOpen ? '' : 'client-preview-stack--expanded'}`}>
      <ClientPreviewToolbar
        previewRef={previewRef}
        clientId={clientId}
        devtoolsOpen={devtoolsOpen}
        onToggleDevtools={onToggleDevtools}
        devtoolsBadge={devtoolsBadge}
      />
      <div className="client-preview-frame">
        <SandpackPreview
          ref={attachPreviewRef}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showNavigator={false}
          showRestartButton={false}
          style={{ height: '100%', flex: 1 }}
        />
      </div>
      {devtoolsOpen && (
        <ClientDevtools
          consoleLog={consoleLog}
          networkLog={networkLog}
          storageSnap={storageSnap}
          runtimeErrors={runtimeErrors}
          onClearNetwork={onClearNetwork}
          onClearConsole={onClearConsole}
          onClearErrors={onClearErrors}
          onClose={onToggleDevtools}
        />
      )}
    </div>
  )
}

const EMPTY_STORAGE = { sessionStorage: {}, localStorage: {}, cookies: '' }

/**
 * In-browser React preview when the backend cannot host Vite (Vercel, etc.).
 */
export default function ClientPreview({ solution, reloadKey = 0 }) {
  const [networkLog, setNetworkLog] = useState([])
  const [consoleLog, setConsoleLog] = useState([])
  const [storageSnap, setStorageSnap] = useState(EMPTY_STORAGE)
  const [runtimeErrors, setRuntimeErrors] = useState([])
  const [devtoolsOpen, setDevtoolsOpen] = useState(false)

  const files = useMemo(
    () => buildSandpackFiles(solution, { apiBaseUrl: getApiBaseUrl() }),
    [solution, reloadKey],
  )

  useEffect(() => {
    setNetworkLog([])
    setConsoleLog([])
    setStorageSnap(EMPTY_STORAGE)
    setRuntimeErrors([])
    setDevtoolsOpen(false)
  }, [reloadKey])

  useEffect(() => {
    if (runtimeErrors.length > 0) setDevtoolsOpen(true)
  }, [runtimeErrors])

  useEffect(() => {
    const failed = networkLog.some((e) => e.error || (e.status && e.status >= 400))
    if (failed && networkLog.length === 1) setDevtoolsOpen(true)
  }, [networkLog])

  useEffect(() => {
    const onMessage = (ev) => {
      const data = ev.data
      if (!data || data.source !== 'rqg-preview') return

      if (data.type === 'network-end') {
        setNetworkLog((prev) => [data, ...prev].slice(0, 100))
      } else if (data.type === 'storage') {
        setStorageSnap({
          sessionStorage: data.sessionStorage || {},
          localStorage: data.localStorage || {},
          cookies: data.cookies || '',
        })
      } else if (data.type === 'runtime-error') {
        setRuntimeErrors((prev) =>
          [{ message: data.message, filename: data.filename, lineno: data.lineno }, ...prev].slice(
            0,
            30,
          ),
        )
      } else if (data.type === 'console') {
        setConsoleLog((prev) =>
          [
            {
              id: `c-${data.time}-${Math.random().toString(36).slice(2, 8)}`,
              level: data.level || 'log',
              message: data.message || '',
              time: data.time,
            },
            ...prev,
          ].slice(0, 150),
        )
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [reloadKey])

  const handleCompileError = useCallback((message) => {
    setRuntimeErrors((prev) =>
      [{ message, filename: 'sandpack', lineno: 0 }, ...prev].slice(0, 30),
    )
    setDevtoolsOpen(true)
  }, [])

  if (!files) return null

  return (
    <div className="client-preview">
      <SandpackProvider
        key={String(reloadKey)}
        template="vite-react"
        files={files}
        theme={SANDPACK_PREVIEW_THEME}
        options={{
          externalResources: [],
          autorun: true,
          autoReload: true,
          recompileMode: 'delayed',
          recompileDelay: 600,
        }}
      >
        <SandpackDiagnostics onCompileError={handleCompileError} />
        <ClientPreviewFrame
          networkLog={networkLog}
          consoleLog={consoleLog}
          storageSnap={storageSnap}
          runtimeErrors={runtimeErrors}
          devtoolsOpen={devtoolsOpen}
          onToggleDevtools={() => setDevtoolsOpen((open) => !open)}
          onClearNetwork={() => setNetworkLog([])}
          onClearConsole={() => setConsoleLog([])}
          onClearErrors={() => setRuntimeErrors([])}
        />
      </SandpackProvider>
    </div>
  )
}
