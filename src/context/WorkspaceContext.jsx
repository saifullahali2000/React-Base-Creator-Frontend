import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACTIVE_SESSION_KEY, apiUrl } from '../config.js'

const WorkspaceContext = createContext(null)

/** Parse failed save response (JSON API errors or HTML/plain from proxies / old servers). */
async function readSaveFailureMessage(res) {
  const raw = await res.text()
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  const tryJson = ct.includes('application/json') || /^\s*\{/.test(raw)
  if (tryJson) {
    try {
      const j = JSON.parse(raw)
      if (j && typeof j.error === 'string' && j.error.trim()) return j.error.trim()
    } catch {
      /* ignore */
    }
  }
  const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (stripped.length > 0 && stripped.length < 220) return stripped
  if (res.status === 404) {
    return 'This session was not found on the server (the backend may have restarted, or the session expired). Generate again, and ensure the API is running and reachable (e.g. correct VITE_API_BASE_URL in production).'
  }
  return `Save failed (${res.status})`
}

/** Legacy saves used "topic_base"; normalize to topin_base. */
function normalizeAssessmentMode(m) {
  if (m === 'open_book') return 'open_book'
  if (m === 'topic_base') return 'topin_base'
  return 'topin_base'
}

function resolvePreviewUrl(raw) {
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return ''
}

function emptyGenerateFlow() {
  return { isGenerating: false, status: '', error: '' }
}

const INITIAL_GENERATE_FLOWS = {
  topin_base: emptyGenerateFlow(),
  open_book: emptyGenerateFlow(),
}

function defaultFileViewerUi(assessmentMode = 'topin_base') {
  return {
    folderTab: assessmentMode === 'open_book' ? 'solution' : 'prefilled',
    selectedPath: null,
    expandedFolderKeys: [],
  }
}

export function WorkspaceProvider({ children }) {
  const navigate = useNavigate()
  const [generateFlows, setGenerateFlows] = useState(INITIAL_GENERATE_FLOWS)
  const [workspaceError, setWorkspaceError] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [projectName, setProjectName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [generatedFiles, setGeneratedFiles] = useState(null)
  const [assessmentMode, setAssessmentMode] = useState('topin_base')
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [previewWorkspaceTab, setPreviewWorkspaceTab] = useState('live')
  const [fileViewerUi, setFileViewerUi] = useState(() => defaultFileViewerUi())

  const fileSaveTimers = useRef(new Map())

  const isGenerating =
    generateFlows.topin_base.isGenerating || generateFlows.open_book.isGenerating

  const patchGenerateFlow = useCallback((mode, patch) => {
    const key = normalizeAssessmentMode(mode)
    setGenerateFlows((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
  }, [])

  const clearGenerateError = useCallback(
    (mode) => patchGenerateFlow(mode, { error: '' }),
    [patchGenerateFlow],
  )

  const busy = isGenerating || restoring

  const clearError = useCallback(() => {
    setWorkspaceError('')
    setGenerateFlows((prev) => ({
      topin_base: { ...prev.topin_base, error: '' },
      open_book: { ...prev.open_book, error: '' },
    }))
  }, [])

  const getGenerateFlow = useCallback(
    (mode) => generateFlows[normalizeAssessmentMode(mode)],
    [generateFlows],
  )

  const applySession = useCallback((payload) => {
    const mode = normalizeAssessmentMode(payload.assessmentMode)
    setSessionId(payload.sessionId)
    setProjectName(payload.projectName ?? '')
    setPreviewUrl(resolvePreviewUrl(payload.previewUrl))
    setGeneratedFiles(payload.files ?? null)
    setAssessmentMode(mode)
    setPreviewReloadKey(0)
    setFileViewerUi(defaultFileViewerUi(mode))
    setPreviewWorkspaceTab('live')
  }, [])

  const clearSession = useCallback(() => {
    setSessionId(null)
    setProjectName('')
    setPreviewUrl('')
    setGeneratedFiles(null)
    setAssessmentMode('topin_base')
    setPreviewReloadKey(0)
    setPreviewWorkspaceTab('live')
    setFileViewerUi(defaultFileViewerUi())
    setGenerateFlows(INITIAL_GENERATE_FLOWS)
    try {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const persistActiveSession = useCallback((id) => {
    try {
      if (id) sessionStorage.setItem(ACTIVE_SESSION_KEY, id)
      else sessionStorage.removeItem(ACTIVE_SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const handleGenerate = useCallback(
    async ({
      aiProvider,
      apiKey,
      model,
      functionality,
      appApiBaseUrls,
      appApiEndpoints,
      testCaseCount,
      screenshots,
      assessmentMode: modeParam = 'topin_base',
    }) => {
      const mode = normalizeAssessmentMode(modeParam)
      patchGenerateFlow(mode, { isGenerating: true, status: 'Sending request...', error: '' })
      setGeneratedFiles(null)

      try {
        const formData = new FormData()
        formData.append('aiProvider', aiProvider ?? 'claude')
        formData.append('apiKey', apiKey)
        formData.append('model', model)
        formData.append('functionality', functionality)
        formData.append('appApiBaseUrls', appApiBaseUrls ?? '')
        formData.append('appApiEndpoints', appApiEndpoints ?? '')
        formData.append('testCaseCount', String(testCaseCount))
        formData.append('assessmentMode', modeParam)
        for (const file of screenshots || []) {
          formData.append('screenshots', file)
        }

        const endpoint = apiUrl('/api/generate')
        const response = await fetch(endpoint, { method: 'POST', body: formData })
        const contentType = (response.headers.get('content-type') || '').toLowerCase()

        if (!response.ok) {
          let detail = ''
          if (contentType.includes('application/json')) {
            const j = await response.json().catch(() => ({}))
            detail = (j.message || j.error || '').trim()
          }
          if (response.status === 500 || response.status === 501) {
            throw new Error(
              detail ||
                `Server error (${response.status}) from ${endpoint}. The API crashed or is misconfigured. If you use split deploy, set VITE_API_BASE_URL to a working API (Render recommended). Full-stack Vercel: leave VITE_API_BASE_URL empty and open /api/health on your app URL.`,
            )
          }
          if (response.status === 504) {
            throw new Error(
              detail ||
                'Gateway timeout (504): the request took too long or the connection idled out. Try again, use a faster model, or host the API on an always-on server (e.g. Render) with adequate timeout limits.',
            )
          }
          throw new Error(detail || `Server error: ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data:')) continue
            const payload = JSON.parse(line.slice(5).trim())

            if (payload.type === 'progress') {
              patchGenerateFlow(mode, { status: payload.message })
            } else if (payload.type === 'done') {
              applySession({
                sessionId: payload.sessionId,
                projectName: payload.projectName,
                assessmentMode: normalizeAssessmentMode(payload.assessmentMode),
                previewUrl: resolvePreviewUrl(payload.previewUrl),
                files: payload.files,
              })
              persistActiveSession(payload.sessionId)
              patchGenerateFlow(mode, { status: `Done! Generated "${payload.projectName}"` })
              navigate('/preview')
            } else if (payload.type === 'error') {
              throw new Error(payload.message)
            }
          }
        }
      } catch (err) {
        const msg =
          err.message === 'Failed to fetch'
            ? 'Failed to fetch — cannot reach the API. Check VITE_API_BASE_URL and redeploy the backend.'
            : err.message
        patchGenerateFlow(mode, { error: msg, status: '' })
      } finally {
        patchGenerateFlow(mode, { isGenerating: false })
      }
    },
    [applySession, navigate, patchGenerateFlow, persistActiveSession],
  )

  const downloadZip = useCallback(async () => {
    if (!sessionId) return
    setWorkspaceError('')
    const res = await fetch(apiUrl(`/api/download/${sessionId}`))
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setWorkspaceError(j.error || `Download failed (${res.status})`)
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'export'}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }, [projectName, sessionId])

  const hydratePreviewFromStorage = useCallback(async () => {
    let id
    try {
      id = sessionStorage.getItem(ACTIVE_SESSION_KEY)
    } catch {
      return false
    }
    if (!id) return false
    setRestoring(true)
    setWorkspaceError('')
    try {
      const res = await fetch(apiUrl(`/api/generations/${id}/restore`), { method: 'POST' })
      if (!res.ok) {
        persistActiveSession(null)
        return false
      }
      const data = await res.json()
      applySession({
        sessionId: data.sessionId,
        projectName: data.projectName,
        assessmentMode: normalizeAssessmentMode(data.assessmentMode),
        previewUrl: resolvePreviewUrl(data.previewUrl),
        files: data.files,
      })
      return true
    } catch {
      persistActiveSession(null)
      return false
    } finally {
      setRestoring(false)
    }
  }, [applySession, persistActiveSession])

  const applyGeneratedFileEdit = useCallback((root, relPath, content) => {
    setGeneratedFiles((prev) => {
      if (!prev) return prev
      if (root === 'ideCoding') {
        try {
          return { ...prev, ideCoding: JSON.parse(content) }
        } catch {
          return prev
        }
      }
      const norm = (relPath || '').replace(/\\/g, '/')
      return {
        ...prev,
        [root]: { ...(prev[root] || {}), [norm]: content },
      }
    })
  }, [])

  const schedulePersistGeneratedFile = useCallback(
    (root, relPath, content, genId) => {
      if (!genId) return
      const pathKey = root === 'ideCoding' ? '_' : (relPath || '').replace(/\\/g, '/')
      const mapKey = `${root}::${pathKey}`
      const prevT = fileSaveTimers.current.get(mapKey)
      if (prevT) clearTimeout(prevT)
      const t = setTimeout(async () => {
        fileSaveTimers.current.delete(mapKey)
        try {
          const body =
            root === 'ideCoding'
              ? { root: 'ideCoding', content }
              : { root, path: pathKey, content }
          const res = await fetch(apiUrl(`/api/generations/${genId}/file`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const msg = await readSaveFailureMessage(res)
            if (res.status === 404) {
              try {
                sessionStorage.removeItem(ACTIVE_SESSION_KEY)
              } catch {
                /* ignore */
              }
            }
            throw new Error(msg)
          }
          if (root === 'solution') setPreviewReloadKey((n) => n + 1)
        } catch (e) {
          setWorkspaceError(e.message || String(e))
        }
      }, 450)
      fileSaveTimers.current.set(mapKey, t)
    },
    [],
  )

  const onSourceFileEdit = useCallback(
    (root, relPath, content) => {
      applyGeneratedFileEdit(root, relPath, content)
      if (!sessionId) return
      schedulePersistGeneratedFile(root, relPath, content, sessionId)
    },
    [applyGeneratedFileEdit, schedulePersistGeneratedFile, sessionId],
  )

  const value = useMemo(
    () => ({
      isGenerating,
      generatingMode: generateFlows.open_book.isGenerating
        ? 'open_book'
        : generateFlows.topin_base.isGenerating
          ? 'topin_base'
          : null,
      generateFlows,
      getGenerateFlow,
      clearGenerateError,
      restoring,
      busy,
      error: workspaceError,
      setError: setWorkspaceError,
      clearError,
      sessionId,
      projectName,
      previewUrl,
      generatedFiles,
      assessmentMode,
      previewReloadKey,
      onSourceFileEdit,
      handleGenerate,
      downloadZip,
      hydratePreviewFromStorage,
      clearSession,
      hasActiveOutput: Boolean(sessionId && generatedFiles),
      previewWorkspaceTab,
      setPreviewWorkspaceTab,
      fileViewerUi,
      setFileViewerUi,
    }),
    [
      busy,
      assessmentMode,
      clearError,
      clearGenerateError,
      clearSession,
      downloadZip,
      generateFlows,
      generatedFiles,
      getGenerateFlow,
      handleGenerate,
      hydratePreviewFromStorage,
      isGenerating,
      onSourceFileEdit,
      previewReloadKey,
      previewUrl,
      projectName,
      previewWorkspaceTab,
      fileViewerUi,
      setFileViewerUi,
      setPreviewWorkspaceTab,
      restoring,
      sessionId,
      workspaceError,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
