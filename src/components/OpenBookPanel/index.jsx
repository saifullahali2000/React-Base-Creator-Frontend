import { useState, useRef, useEffect, useCallback } from 'react'
import {
  PROVIDER_OPTIONS,
  API_KEY_STORAGE,
  modelStorageKey,
  readStoredProvider,
  readStoredModel,
  loadStoredApiKeys,
  getProviderMeta,
} from '../../config/aiProviders.js'
import ProviderModelSelect from '../ProviderModelSelect'
import SpeechTextarea from '../SpeechTextarea'
import TokenEstimateBar from '../TokenEstimateBar'
import useTokenEstimate from '../../hooks/useTokenEstimate'
import { readImageDimensions } from '../../utils/tokenEstimate.js'
import '../GeneratorPanel/index.css'

const MAX_SCREENSHOTS = 24

export default function OpenBookPanel({ onGenerate, isGenerating, status, error }) {
  const [aiProvider, setAiProvider] = useState(() => readStoredProvider('rqg_ob_ai_provider'))
  const [apiKeys, setApiKeys] = useState(() => loadStoredApiKeys())
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState(() => readStoredModel(readStoredProvider('rqg_ob_ai_provider')))
  const [functionality, setFunctionality] = useState(() => localStorage.getItem('rqg_ob_functionality') || '')
  const [appApiBaseUrls, setAppApiBaseUrls] = useState(() => localStorage.getItem('rqg_ob_api_bases') || '')
  const [appApiEndpoints, setAppApiEndpoints] = useState(() => localStorage.getItem('rqg_ob_api_endpoints') || '')
  const [screenshots, setScreenshots] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const screenshotsRef = useRef(screenshots)
  screenshotsRef.current = screenshots

  useEffect(() => () => {
    screenshotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
  }, [])

  useEffect(() => {
    Object.entries(apiKeys).forEach(([provider, key]) => {
      localStorage.setItem(API_KEY_STORAGE[provider], key)
    })
  }, [apiKeys])
  useEffect(() => { localStorage.setItem('rqg_ob_ai_provider', aiProvider) }, [aiProvider])
  useEffect(() => {
    localStorage.setItem(modelStorageKey(aiProvider), model)
    localStorage.setItem('rqg_model', model)
  }, [model, aiProvider])
  useEffect(() => { localStorage.setItem('rqg_ob_functionality', functionality) }, [functionality])
  useEffect(() => { localStorage.setItem('rqg_ob_api_bases', appApiBaseUrls) }, [appApiBaseUrls])
  useEffect(() => { localStorage.setItem('rqg_ob_api_endpoints', appApiEndpoints) }, [appApiEndpoints])

  const addImageFiles = async (fileList) => {
    if (!fileList?.length) return
    const images = [...fileList].filter((f) => f.type.startsWith('image/'))
    if (!images.length) return

    const prevLen = screenshotsRef.current.length
    const room = MAX_SCREENSHOTS - prevLen
    if (room <= 0) return
    const toAdd = images.slice(0, room)

    const entries = await Promise.all(
      toAdd.map(async (file) => {
        const dims = await readImageDimensions(file)
        return {
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          width: dims.width,
          height: dims.height,
          bytes: dims.bytes,
        }
      })
    )

    setScreenshots((prev) => [...prev, ...entries])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    addImageFiles(e.dataTransfer.files)
  }

  const handleProviderChange = (e) => {
    const p = e.target.value
    setAiProvider(p)
    setModel(readStoredModel(p))
  }

  const providerMeta = getProviderMeta(aiProvider)
  const activeApiKey = apiKeys[aiProvider] ?? ''

  const handleSubmit = (e) => {
    e.preventDefault()
    const key = activeApiKey
    if (!key.trim()) {
      return alert(providerMeta.keyMissing)
    }
    if (!functionality.trim()) return alert('Please describe what the reference solution should implement.')
    const files = screenshots.map((s) => s.file)
    onGenerate({
      assessmentMode: 'open_book',
      aiProvider,
      apiKey: key.trim(),
      model,
      functionality: functionality.trim(),
      appApiBaseUrls: appApiBaseUrls.trim(),
      appApiEndpoints: appApiEndpoints.trim(),
      testCaseCount: 0,
      screenshots: files,
    })
  }

  const removeScreenshot = (id) => {
    setScreenshots((prev) => {
      const item = prev.find((s) => s.id === id)
      if (item?.url) URL.revokeObjectURL(item.url)
      return prev.filter((s) => s.id !== id)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearAllScreenshots = () => {
    setScreenshots((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url))
      return []
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), [])
  const atLimit = screenshots.length >= MAX_SCREENSHOTS

  const { estimate, loading: tokenLoading, error: tokenError } = useTokenEstimate({
    assessmentMode: 'open_book',
    testCaseCount: 0,
    functionality,
    appApiBaseUrls,
    appApiEndpoints,
    screenshots,
  })

  return (
    <form className="gen-panel" onSubmit={handleSubmit}>
      <p className="gen-open-book-intro">
        Open book assessments ship as <strong>solution code only</strong> (no prefilled learner stub, no test
        project). Preview and ZIP use the <code className="gen-code">ProjectName_Solution</code> folder only.
      </p>

      <div className="gen-form-grid">
        <div className="gen-field">
          <label className="gen-label" htmlFor="ob-ai-provider">
            <span className="gen-label-icon">🧠</span> AI provider
          </label>
          <select id="ob-ai-provider" className="gen-input gen-select" value={aiProvider} onChange={handleProviderChange}>
            {PROVIDER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="gen-field">
          <label className="gen-label" htmlFor="ob-model">
            <span className="gen-label-icon">🤖</span> Model
          </label>
          <ProviderModelSelect
            id="ob-model"
            provider={aiProvider}
            model={model}
            onModelChange={setModel}
            apiKey={activeApiKey}
          />
        </div>
      </div>
      <p className="gen-hint gen-hint-grid">Keys stay in your browser; only the active provider key is sent to your backend.</p>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">🔑</span> {providerMeta.keyLabel}
        </label>
        <div className="api-key-row">
          <input
            type={showKey ? 'text' : 'password'}
            className="gen-input"
            placeholder={providerMeta.keyPlaceholder}
            value={activeApiKey}
            onChange={(e) =>
              setApiKeys((prev) => ({ ...prev, [aiProvider]: e.target.value }))}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="icon-btn" onClick={() => setShowKey((v) => !v)} title={showKey ? 'Hide key' : 'Show key'}>
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">📸</span> UI Screenshots{' '}
          <span className="gen-optional">(optional, up to {MAX_SCREENSHOTS})</span>
        </label>
        {screenshots.length > 0 && (
          <div className="screenshot-grid">
            {screenshots.map((s) => (
              <div key={s.id} className="screenshot-thumb">
                <img src={s.url} alt="" />
                <button
                  type="button"
                  className="screenshot-thumb-remove"
                  onClick={() => removeScreenshot(s.id)}
                  title="Remove"
                  aria-label="Remove image"
                >
                  ✕
                </button>
                <span className="screenshot-thumb-name" title={s.file.name}>
                  {s.file.name}
                </span>
              </div>
            ))}
          </div>
        )}
        {screenshots.length > 0 && (
          <div className="screenshot-toolbar">
            <button type="button" className="screenshot-add-btn" onClick={openFilePicker} disabled={atLimit}>
              + Add more
            </button>
            <button type="button" className="screenshot-clear-btn" onClick={clearAllScreenshots}>
              Clear all
            </button>
            {atLimit && <span className="screenshot-limit-note">Maximum reached</span>}
          </div>
        )}
        {!atLimit && (
          <div
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onClick={openFilePicker}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="drop-icon">🖼</span>
            <span className="drop-text">
              {screenshots.length
                ? 'Drop more images or click to browse'
                : 'Drop images or click to browse (multi-select OK)'}
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addImageFiles(e.target.files)}
        />
      </div>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">⚙️</span> What to build (reference solution)
        </label>
        <p className="gen-hint gen-hint-tight">
          Describe the full app the model should implement in the solution tree only — no starter/prefilled split.
        </p>
        <SpeechTextarea
          value={functionality}
          onChange={setFunctionality}
          rows={9}
          placeholder="Example: Multi-step checkout with cart, shipping form, and confirmation; use React Router for steps."
        />
      </div>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">🌐</span> Backend API{' '}
          <span className="gen-optional">(optional)</span>
        </label>
        <label className="gen-sublabel">Base URLs (one per line)</label>
        <textarea
          className="gen-textarea gen-textarea-sm gen-input-mb"
          placeholder="https://api.example.com"
          value={appApiBaseUrls}
          onChange={(e) => setAppApiBaseUrls(e.target.value)}
          rows={4}
          spellCheck={false}
        />
        <label className="gen-sublabel">Endpoints and contracts</label>
        <textarea
          className="gen-textarea gen-textarea-sm"
          placeholder="GET /items — list; POST /items — create…"
          value={appApiEndpoints}
          onChange={(e) => setAppApiEndpoints(e.target.value)}
          rows={5}
          spellCheck={false}
        />
      </div>

      {aiProvider === 'gemini' && (
        <p className="gen-hint gen-hint-tight gen-gemini-quota-hint">
          Free Gemini keys have strict quotas. If you see 429 errors, use <strong>2.0 Flash</strong> or{' '}
          <strong>2.5 Flash</strong>.
        </p>
      )}

      <TokenEstimateBar
        estimate={estimate}
        loading={tokenLoading}
        error={tokenError}
        partial={estimate?.partial}
      />

      <div className="gen-actions">
        <button type="submit" className={`generate-btn ${isGenerating ? 'loading' : ''}`} disabled={isGenerating}>
          {isGenerating ? (
            <>
              <span className="spinner" /> Generating…
            </>
          ) : (
            <>📖 Generate open book solution</>
          )}
        </button>
      </div>

      {(status || error) && (
        <div className={`gen-status ${error ? 'error' : 'progress'}`}>
          {error ? (
            <>
              <span className="status-icon">✕</span>
              <span>{error}</span>
            </>
          ) : (
            <>
              <span className="status-icon">{status.startsWith('Done') ? '✓' : '◌'}</span>
              <span>{status}</span>
            </>
          )}
        </div>
      )}
    </form>
  )
}
