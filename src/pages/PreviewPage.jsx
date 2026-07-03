import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PreviewPanel from '../components/PreviewPanel'
import FileViewer from '../components/FileViewer'
import { useWorkspace } from '../context/WorkspaceContext.jsx'

export default function PreviewPage() {
  const {
    sessionId,
    projectName,
    previewUrl,
    generatedFiles,
    assessmentMode,
    previewReloadKey,
    onSourceFileEdit,
    isGenerating,
    downloadZip,
    error,
    clearError,
    hydratePreviewFromStorage,
    previewWorkspaceTab,
    setPreviewWorkspaceTab,
  } = useWorkspace()

  const tab = previewWorkspaceTab
  const setTab = setPreviewWorkspaceTab
  const hasOutput = Boolean(sessionId && generatedFiles)
  const [phase, setPhase] = useState(() => (hasOutput ? 'ready' : 'loading'))

  useEffect(() => {
    if (sessionId && generatedFiles) {
      setPhase('ready')
      return
    }
    let cancelled = false
    setPhase('loading')
    void (async () => {
      const ok = await hydratePreviewFromStorage()
      if (cancelled) return
      if (!ok) setPhase('empty')
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId, generatedFiles, hydratePreviewFromStorage])

  const showMain = hasOutput
  const showSpinner = !showMain && phase === 'loading'
  const showEmpty = !showMain && phase === 'empty'

  return (
    <div className="page page--preview">
      {error && (
        <div className="page-banner page-banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="page-banner-dismiss" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      {(showSpinner || showEmpty) && (
        <header className="page-hero">
          <p className="page-hero-kicker">Output</p>
          <p className="page-route-subtitle">
            Run a generation to see the live app and source files here.
          </p>
        </header>
      )}

      {showSpinner && (
        <div className="page-center-msg">
          <div className="page-center-spinner" />
          <p className="page-center-title">Loading preview…</p>
          <p className="page-center-sub">Restoring your last session from the server.</p>
        </div>
      )}

      {showEmpty && (
        <div className="page-center-msg">
          <div className="page-center-icon" aria-hidden>
            ▣
          </div>
          <p className="page-center-title">No preview yet</p>
          <p className="page-center-sub">
            Run <strong>Generate</strong> from <Link to="/topin-base">Topin base</Link> or{' '}
            <Link to="/open-book">Open book</Link>.
          </p>
          <div className="page-center-actions">
            <Link to="/topin-base" className="page-primary-link">
              Topin base
            </Link>
            <Link to="/open-book" className="page-secondary-link">
              Open book
            </Link>
          </div>
        </div>
      )}

      {showMain && (
        <>
          <div className="preview-workspace-bar">
            <div className="tab-group" role="tablist" aria-label="Preview workspace">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'live'}
                className={`tab-btn ${tab === 'live' ? 'active' : ''}`}
                onClick={() => setTab('live')}
              >
                <span className="tab-icon" aria-hidden="true">
                  ◆
                </span>{' '}
                Live preview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'files'}
                className={`tab-btn ${tab === 'files' ? 'active' : ''}`}
                onClick={() => setTab('files')}
              >
                <span className="tab-icon" aria-hidden="true">
                  ◇
                </span>{' '}
                Source files
              </button>
            </div>

            <div className="preview-workspace-bar__meta">
              <span className="preview-workspace-project" title={sessionId}>
                {projectName || 'Untitled'}
              </span>
              {assessmentMode === 'open_book' && (
                <span className="preview-route-badge" title="Open book — solution-only ZIP">
                  Open book
                </span>
              )}
            </div>

            <button
              type="button"
              className="download-btn download-btn--compact"
              onClick={downloadZip}
              title="Download ZIP"
            >
              ↓ ZIP
            </button>
          </div>

          <div className="preview-route-body surface-card surface-card--flush">
            <div
              className={`preview-workspace-pane ${tab === 'live' ? 'preview-workspace-pane--active' : 'preview-workspace-pane--hidden'}`}
              role="tabpanel"
              aria-hidden={tab !== 'live'}
            >
              <PreviewPanel
                previewUrl={previewUrl}
                solution={generatedFiles?.solution}
                isGenerating={isGenerating}
                reloadKey={previewReloadKey}
                hasGeneratedOutput={hasOutput}
              />
            </div>
            <div
              className={`preview-workspace-pane ${tab === 'files' ? 'preview-workspace-pane--active' : 'preview-workspace-pane--hidden'}`}
              role="tabpanel"
              aria-hidden={tab !== 'files'}
            >
              {generatedFiles && (
                <FileViewer
                  files={generatedFiles}
                  assessmentMode={assessmentMode}
                  onSourceFileEdit={onSourceFileEdit}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
