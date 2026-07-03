import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../config.js'
import { readApiError } from '../utils/apiError.js'
import {
  MODELS_BY_PROVIDER,
  CURSOR_FALLBACK_MODELS,
  CURSOR_MODELS_CACHE_KEY,
  OPENROUTER_FALLBACK_MODELS,
  OPENROUTER_MODELS_CACHE_KEY,
  groupModelsForSelect,
} from '../config/aiProviders.js'

const CACHE_TTL_MS = 60 * 60 * 1000

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.fetchedAt || !Array.isArray(parsed.models)) return null
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null
    return parsed.models
  } catch {
    return null
  }
}

function writeCache(key, models) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ fetchedAt: Date.now(), models }),
    )
  } catch {
    /* ignore */
  }
}

/**
 * @param {'claude'|'gemini'|'deepseek'|'grok'|'cursor'|'openrouter'} provider
 * @param {string} apiKey
 */
export function useProviderModels(provider, apiKey) {
  const [openRouterModels, setOpenRouterModels] = useState(() => readCache(OPENROUTER_MODELS_CACHE_KEY) || [])
  const [cursorModels, setCursorModels] = useState(() => readCache(CURSOR_MODELS_CACHE_KEY) || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (provider !== 'openrouter') {
      if (provider !== 'cursor') {
        setError('')
      }
      if (provider !== 'openrouter' && provider !== 'cursor') return undefined
    }

    if (provider === 'openrouter') {
      let cancelled = false
      const cached = readCache(OPENROUTER_MODELS_CACHE_KEY)
      if (cached?.length) {
        setOpenRouterModels(cached)
      }

      async function loadOpenRouter() {
        setLoading(true)
        setError('')
        try {
          const res = await fetch(apiUrl('/api/openrouter/models'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: apiKey?.trim() || '' }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(await readApiError(res, 'Failed to load models'))
          const mapped = (data.models || []).map((m) => ({
            value: m.id,
            label: m.name,
            group: m.group,
          }))
          if (cancelled) return
          setOpenRouterModels(mapped)
          if (mapped.length) writeCache(OPENROUTER_MODELS_CACHE_KEY, mapped)
        } catch (e) {
          if (!cancelled) {
            const msg = e.message || 'Could not load OpenRouter models'
            setError(
              msg === 'Failed to fetch'
                ? 'Failed to fetch — API unreachable (check VITE_API_BASE_URL, redeploy backend, or CORS).'
                : msg,
            )
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      void loadOpenRouter()
      return () => {
        cancelled = true
      }
    }

    if (!apiKey?.trim()) {
      setError('')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    const cached = readCache(CURSOR_MODELS_CACHE_KEY)
    if (cached?.length) {
      setCursorModels(cached)
    }

    async function loadCursor() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(apiUrl('/api/cursor/models'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: apiKey?.trim() || '' }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(await readApiError(res, 'Failed to load models'))
        const mapped = (data.models || []).map((m) => ({
          value: m.id,
          label: m.name,
          group: m.group,
        }))
        if (cancelled) return
        setCursorModels(mapped)
        if (mapped.length) writeCache(CURSOR_MODELS_CACHE_KEY, mapped)
      } catch (e) {
        if (!cancelled) {
          const msg = e.message || 'Could not load Cursor models'
          setError(
            msg === 'Failed to fetch'
              ? 'Failed to fetch — API unreachable (check VITE_API_BASE_URL, redeploy backend, or CORS).'
              : msg,
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCursor()
    return () => {
      cancelled = true
    }
  }, [provider, apiKey])

  const models = useMemo(() => {
    if (provider === 'openrouter') {
      return openRouterModels.length ? openRouterModels : OPENROUTER_FALLBACK_MODELS
    }
    if (provider === 'cursor') {
      return cursorModels.length ? cursorModels : CURSOR_FALLBACK_MODELS
    }
    return MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.claude
  }, [provider, openRouterModels, cursorModels])

  const grouped = useMemo(() => groupModelsForSelect(models), [models])

  const catalogPendingKey = provider === 'cursor' && !apiKey?.trim()

  return { models, grouped, loading, error, catalogPendingKey }
}
