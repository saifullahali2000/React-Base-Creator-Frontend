import { useState } from 'react'
import './index.css'

const TABS = [
  { id: 'console', label: 'Console' },
  { id: 'network', label: 'Network' },
  { id: 'application', label: 'Application' },
]

const CONSOLE_LEVEL_CLASS = {
  log: 'devtools-log--log',
  info: 'devtools-log--info',
  warn: 'devtools-log--warn',
  error: 'devtools-log--error',
  debug: 'devtools-log--debug',
}

function statusClass(entry) {
  if (entry.error) return 'devtools-net--err'
  if (!entry.ok && entry.status) return 'devtools-net--warn'
  if (entry.status >= 400) return 'devtools-net--warn'
  return 'devtools-net--ok'
}

function ConsolePanel({ logs, runtimeErrors, onClearLogs, onClearErrors }) {
  return (
    <div className="devtools-panel devtools-panel--console">
      {runtimeErrors.length > 0 && (
        <div className="devtools-runtime-errors">
          <div className="devtools-panel-toolbar">
            <span className="devtools-panel-meta">Runtime errors</span>
            <button type="button" className="devtools-panel-action" onClick={onClearErrors}>
              Clear errors
            </button>
          </div>
          <ul className="devtools-error-list">
            {runtimeErrors.map((err, i) => (
              <li key={`${err.message}-${i}`}>
                <strong>{err.message}</strong>
                {err.filename && (
                  <span className="devtools-error-loc">
                    {' '}
                    — {err.filename}:{err.lineno}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="devtools-panel-toolbar">
        <span className="devtools-panel-meta">App console ({logs.length})</span>
        <button type="button" className="devtools-panel-action" onClick={onClearLogs}>
          Clear
        </button>
      </div>
      {logs.length === 0 ? (
        <p className="devtools-empty">
          No app logs yet. <code>console.log</code> output from the preview appears here (not Vite
          build output).
        </p>
      ) : (
        <ul className="devtools-console-list">
          {logs.map((entry) => (
            <li
              key={entry.id}
              className={`devtools-console-line ${CONSOLE_LEVEL_CLASS[entry.level] || 'devtools-log--log'}`}
            >
              <span className="devtools-console-level">{entry.level}</span>
              <span className="devtools-console-msg">{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NetworkPanel({ entries, onClear }) {
  const [expandedId, setExpandedId] = useState(null)

  return (
    <div className="devtools-panel devtools-panel--network">
      <div className="devtools-panel-toolbar">
        <span className="devtools-panel-meta">{entries.length} request(s)</span>
        <button type="button" className="devtools-panel-action" onClick={onClear}>
          Clear
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="devtools-empty">No network activity yet. Interact with the preview to see API calls.</p>
      ) : (
        <div className="devtools-network-list">
          {entries.map((entry) => (
            <div key={entry.id} className={`devtools-network-row ${statusClass(entry)}`}>
              <button
                type="button"
                className="devtools-network-summary"
                onClick={() => setExpandedId((id) => (id === entry.id ? null : entry.id))}
              >
                <span className="devtools-net-method">{entry.method}</span>
                <span className="devtools-net-status">
                  {entry.error ? 'FAILED' : entry.status || '—'}
                </span>
                <span className="devtools-net-url" title={entry.url}>
                  {entry.url}
                </span>
                <span className="devtools-net-time">{entry.durationMs}ms</span>
              </button>
              {expandedId === entry.id && (
                <div className="devtools-network-detail">
                  {entry.proxied && <p className="devtools-net-flag">Proxied via backend</p>}
                  {entry.error && (
                    <p className="devtools-net-error">
                      <strong>Error:</strong> {entry.error}
                    </p>
                  )}
                  {entry.responsePreview && (
                    <pre className="devtools-net-body">{entry.responsePreview}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StorageTable({ title, data }) {
  const keys = Object.keys(data || {})
  if (!keys.length) {
    return (
      <div className="devtools-storage-block">
        <h4 className="devtools-storage-title">{title}</h4>
        <p className="devtools-empty devtools-empty--inline">Empty</p>
      </div>
    )
  }
  return (
    <div className="devtools-storage-block">
      <h4 className="devtools-storage-title">{title}</h4>
      <table className="devtools-storage-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <td className="devtools-storage-key">{key}</td>
              <td className="devtools-storage-val">
                <code>{String(data[key]).slice(0, 200)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApplicationPanel({ storage }) {
  const cookiePairs = (storage.cookies || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <div className="devtools-panel devtools-panel--application">
      <StorageTable title="Session storage" data={storage.sessionStorage} />
      <StorageTable title="Local storage" data={storage.localStorage} />
      <div className="devtools-storage-block">
        <h4 className="devtools-storage-title">Cookies</h4>
        {!cookiePairs.length ? (
          <p className="devtools-empty devtools-empty--inline">Empty</p>
        ) : (
          <ul className="devtools-cookie-list">
            {cookiePairs.map((pair) => (
              <li key={pair}>
                <code>{pair}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function ClientDevtools({
  consoleLog,
  networkLog,
  storageSnap,
  runtimeErrors,
  onClearConsole,
  onClearNetwork,
  onClearErrors,
  onClose,
}) {
  const [tab, setTab] = useState('console')

  const issueCount =
    runtimeErrors.length + networkLog.filter((e) => e.error || (e.status && e.status >= 400)).length

  return (
    <div className="client-devtools">
      <div className="client-devtools-head">
        <div className="client-devtools-tabs" role="tablist" aria-label="Preview developer tools">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`client-devtools-tab ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
              {id === 'network' && networkLog.length > 0 && (
                <span className="client-devtools-badge">{networkLog.length}</span>
              )}
              {id === 'console' && (runtimeErrors.length > 0 || consoleLog.length > 0) && (
                <span
                  className={`client-devtools-badge ${runtimeErrors.length > 0 ? 'client-devtools-badge--error' : ''}`}
                >
                  {runtimeErrors.length || consoleLog.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="client-devtools-head-actions">
          {issueCount > 0 && (
            <span className="client-devtools-issue-hint">{issueCount} issue(s)</span>
          )}
          <button type="button" className="client-devtools-toggle" onClick={onClose}>
            Close devtools
          </button>
        </div>
      </div>

      <div className="client-devtools-body">
        {tab === 'console' && (
          <ConsolePanel
            logs={consoleLog}
            runtimeErrors={runtimeErrors}
            onClearLogs={onClearConsole}
            onClearErrors={onClearErrors}
          />
        )}
        {tab === 'network' && <NetworkPanel entries={networkLog} onClear={onClearNetwork} />}
        {tab === 'application' && <ApplicationPanel storage={storageSnap} />}
      </div>
    </div>
  )
}
