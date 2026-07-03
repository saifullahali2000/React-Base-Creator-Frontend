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
import './index.css'

const MAX_SCREENSHOTS = 24

export default function GeneratorPanel({ onGenerate, isGenerating, status, error }) {
  const [aiProvider, setAiProvider] = useState(() => readStoredProvider('rqg_tb_ai_provider'))
  const [apiKeys, setApiKeys] = useState(() => loadStoredApiKeys())
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState(() => readStoredModel(readStoredProvider('rqg_tb_ai_provider')))
  const [functionality, setFunctionality] = useState(() => localStorage.getItem('rqg_functionality') || '')
  const [appApiBaseUrls, setAppApiBaseUrls] = useState(() => {
    const saved = localStorage.getItem('rqg_app_api_bases')
    if (saved) return saved
    const legacy = localStorage.getItem('rqg_app_api_base')
    return legacy || ''
  })
  const [appApiEndpoints, setAppApiEndpoints] = useState(() => localStorage.getItem('rqg_app_api_endpoints') || '')
  const [testCaseCount, setTestCaseCount] = useState(10)
  const [skipTests, setSkipTests] = useState(false)
  const testCountWhenEnabledRef = useRef(10)
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
  useEffect(() => { localStorage.setItem('rqg_tb_ai_provider', aiProvider) }, [aiProvider])
  useEffect(() => {
    localStorage.setItem(modelStorageKey(aiProvider), model)
    localStorage.setItem('rqg_model', model)
  }, [model, aiProvider])
  useEffect(() => { localStorage.setItem('rqg_functionality', functionality) }, [functionality])
  useEffect(() => { localStorage.setItem('rqg_app_api_bases', appApiBaseUrls) }, [appApiBaseUrls])
  useEffect(() => { localStorage.setItem('rqg_app_api_endpoints', appApiEndpoints) }, [appApiEndpoints])

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
    if (!functionality.trim()) return alert('Please describe the functionality the application should have.')
    const files = screenshots.map((s) => s.file)
    onGenerate({
      assessmentMode: 'topin_base',
      aiProvider,
      apiKey: key.trim(),
      model,
      functionality: functionality.trim(),
      appApiBaseUrls: appApiBaseUrls.trim(),
      appApiEndpoints: appApiEndpoints.trim(),
      testCaseCount,
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

  const openFilePicker = () => fileInputRef.current?.click()

  const handleSkipTestsChange = useCallback((e) => {
    const checked = e.target.checked
    setSkipTests(checked)
    if (checked) {
      testCountWhenEnabledRef.current =
        Number.isFinite(testCaseCount) && testCaseCount > 0 ? testCaseCount : 10
      setTestCaseCount(0)
    } else {
      const prev = testCountWhenEnabledRef.current
      setTestCaseCount(Math.min(100, Math.max(1, Number.isFinite(prev) && prev > 0 ? prev : 10)))
    }
  }, [testCaseCount])

  const atLimit = screenshots.length >= MAX_SCREENSHOTS

  const effectiveTestCaseCount = skipTests ? 0 : testCaseCount
  const { estimate, loading: tokenLoading, error: tokenError } = useTokenEstimate({
    assessmentMode: 'topin_base',
    testCaseCount: effectiveTestCaseCount,
    functionality,
    appApiBaseUrls,
    appApiEndpoints,
    screenshots,
  })

  return (
    <form className="gen-panel" onSubmit={handleSubmit}>
      <div className="gen-form-grid">
        <div className="gen-field">
          <label className="gen-label" htmlFor="tb-ai-provider">
            <span className="gen-label-icon">🧠</span> AI provider
          </label>
          <select
            id="tb-ai-provider"
            className="gen-input gen-select"
            value={aiProvider}
            onChange={handleProviderChange}
          >
            {PROVIDER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="gen-field">
          <label className="gen-label" htmlFor="tb-model">
            <span className="gen-label-icon">🤖</span> Model
          </label>
          <ProviderModelSelect
            id="tb-model"
            provider={aiProvider}
            model={model}
            onModelChange={setModel}
            apiKey={activeApiKey}
          />
        </div>
      </div>
      <p className="gen-hint gen-hint-grid">
        Keys stay in your browser; only the active provider key is sent to your backend for each run.
      </p>

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
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowKey((v) => !v)}
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? '🙈' : '👁'}
          </button>
        </div>
        <p className="gen-hint">{providerMeta.keyHint}</p>
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <span className="drop-icon">🖼</span>
            <span className="drop-text">
              {screenshots.length
                ? 'Drop more images or click to browse (multi-select OK)'
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
          <span className="gen-label-icon">⚙️</span> Application functionality
        </label>
        <p className="gen-hint gen-hint-tight">
          Describe what the app should do: screens, user flows, validation rules, and data to show or collect — not an exam question.
        </p>
        <SpeechTextarea
          value={functionality}
          onChange={setFunctionality}
          rows={9}
          placeholder={
            'Example:\n- List products from the API with loading and error states.\n- Search by name; clicking a row opens a detail panel.\n- Form to create an item: required fields, inline errors, success toast.\n- Logout clears jwt_token cookie and returns to home.'
          }
        />
      </div>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">🌐</span> App backend API{' '}
          <span className="gen-optional">(optional)</span>
        </label>
        <p className="gen-hint gen-hint-tight">
          Use one line per base when you have more than one service (for example auth vs catalog). Then list which endpoints belong to which base. The generator will wire <code className="gen-code">src/api/</code> and document the same contract in the question text; tests use MSW.
        </p>
        <label className="gen-sublabel">Base URLs (one per line, optional labels)</label>
        <textarea
          className="gen-textarea gen-textarea-sm gen-input-mb"
          placeholder={'Auth (sign-in / tokens):\nhttps://auth.example.com\n\nData (lists, CRUD):\nhttps://api.example.com/v1'}
          value={appApiBaseUrls}
          onChange={(e) => setAppApiBaseUrls(e.target.value)}
          rows={5}
          spellCheck={false}
        />
        <label className="gen-sublabel">Endpoints and contracts</label>
        <textarea
          className="gen-textarea gen-textarea-sm"
          placeholder={'Note which base each call uses if you have several.\n\nAuth — POST https://auth.example.com/login\n  body: { email, password }\n  200: { token }\n\nData — GET https://api.example.com/v1/products\n  200: { items: [...] }'}
          value={appApiEndpoints}
          onChange={(e) => setAppApiEndpoints(e.target.value)}
          rows={6}
          spellCheck={false}
        />
      </div>

      <div className="gen-field">
        <label className="gen-label">
          <span className="gen-label-icon">📊</span> Test cases
        </label>
        <div className="gen-test-row">
          <label className="gen-checkbox-row">
            <input
              type="checkbox"
              checked={skipTests}
              onChange={handleSkipTestsChange}
            />
            <span>I don&apos;t need test cases</span>
          </label>
          <div className="gen-test-count">
            <span className="gen-sublabel gen-sublabel-inline">Count</span>
            <input
              type="text"
              className="gen-input gen-input-sm"
              min={1}
              max={100}
              value={skipTests ? 0 : testCaseCount}
              disabled={skipTests}
              aria-label="Number of test cases"
              onChange={(e) => {
                const v = Number(e.target.value)
                const n = Number.isFinite(v) ? Math.min(100, Math.max(1, Math.floor(v))) : 1
                setTestCaseCount(n)
                testCountWhenEnabledRef.current = n
              }}
            />
          </div>
        </div>
      </div>

      {aiProvider === 'gemini' && (
        <p className="gen-hint gen-hint-tight gen-gemini-quota-hint">
          Free Gemini keys have strict quotas. If you see 429 / quota errors, switch to{' '}
          <strong>2.0 Flash</strong> or <strong>2.5 Flash</strong>; <strong>2.5 Pro</strong> often has no free-tier
          quota until you enable billing in Google AI Studio.
        </p>
      )}

      <TokenEstimateBar
        estimate={estimate}
        loading={tokenLoading}
        error={tokenError}
        partial={estimate?.partial}
      />

      <div className="gen-actions">
        <button
          type="submit"
          className={`generate-btn ${isGenerating ? 'loading' : ''}`}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner" /> Generating...
            </>
          ) : (
            <>🚀 Generate Question</>
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
              <span className="status-icon">
                {status.startsWith('Done') ? '✓' : '◌'}
              </span>
              <span>{status}</span>
            </>
          )}
        </div>
      )}
    </form>
  )
}
