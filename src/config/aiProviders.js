export const AI_PROVIDERS = ['claude', 'gemini', 'deepseek', 'grok', 'cursor', 'openrouter']

export const PROVIDER_OPTIONS = [
  { value: 'claude', label: 'Anthropic Claude' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'grok', label: 'xAI Grok' },
  { value: 'cursor', label: 'Cursor (Cloud Agents)' },
  { value: 'openrouter', label: 'OpenRouter (all models)' },
]

export const MODELS_BY_PROVIDER = {
  claude: [
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — Cheap', group: 'Anthropic' },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — Best Quality', group: 'Anthropic' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — best for free tier', group: 'Google' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — free tier friendly', group: 'Google' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — usually needs paid billing', group: 'Google' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash — fast', group: 'DeepSeek' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro — quality', group: 'DeepSeek' },
    { value: 'deepseek-chat', label: 'DeepSeek Chat', group: 'DeepSeek' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', group: 'DeepSeek' },
  ],
  grok: [
    { value: 'grok-3-mini', label: 'Grok 3 Mini — fast & cheap', group: 'xAI' },
    { value: 'grok-3', label: 'Grok 3', group: 'xAI' },
    { value: 'grok-4-1-fast-non-reasoning', label: 'Grok 4.1 Fast', group: 'xAI' },
    { value: 'grok-4-1-fast-reasoning', label: 'Grok 4.1 Fast (reasoning)', group: 'xAI' },
  ],
  cursor: [],
  openrouter: [],
}

/** Shown until the live Cursor catalog loads (from GET /v1/models) */
export const CURSOR_FALLBACK_MODELS = [
  { value: 'composer-2', label: 'Composer 2 — Cursor agent model', group: 'Cursor' },
  {
    value: 'claude-4.6-sonnet-thinking',
    label: 'Claude 4.6 Sonnet (Thinking)',
    group: 'Cursor',
  },
  {
    value: 'claude-4.5-sonnet-thinking',
    label: 'Claude 4.5 Sonnet (Thinking)',
    group: 'Cursor',
  },
  { value: 'claude-4-sonnet-thinking', label: 'Claude 4 Sonnet (Thinking)', group: 'Cursor' },
  { value: 'gpt-5.2', label: 'GPT-5.2', group: 'Cursor' },
]

/** Shown until the live OpenRouter catalog loads */
export const OPENROUTER_FALLBACK_MODELS = [
  { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', group: 'Google (Gemini)' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', group: 'Anthropic (Claude)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', group: 'OpenAI (GPT)' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', group: 'DeepSeek' },
  { value: 'x-ai/grok-3-mini', label: 'Grok 3 Mini', group: 'xAI (Grok)' },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', group: 'Meta Llama' },
]

export const DEFAULT_MODEL_BY_PROVIDER = {
  claude: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-v4-flash',
  grok: 'grok-3-mini',
  cursor: 'composer-2',
  openrouter: 'google/gemini-2.0-flash-001',
}

export const API_KEY_STORAGE = {
  claude: 'rqg_apikey',
  gemini: 'rqg_gemini_apikey',
  deepseek: 'rqg_deepseek_apikey',
  grok: 'rqg_grok_apikey',
  cursor: 'rqg_cursor_apikey',
  openrouter: 'rqg_openrouter_apikey',
}

export const CURSOR_MODELS_CACHE_KEY = 'rqg_cursor_models_cache_v1'
export const OPENROUTER_MODELS_CACHE_KEY = 'rqg_openrouter_models_cache_v1'

export function modelStorageKey(provider) {
  return `rqg_model_${provider}`
}

export function readStoredProvider(panelKey) {
  const v = localStorage.getItem(panelKey)
  if (AI_PROVIDERS.includes(v)) return v
  const legacy = localStorage.getItem('rqg_ai_provider')
  if (AI_PROVIDERS.includes(legacy)) return legacy
  return 'claude'
}

export function readStoredModel(provider) {
  const key = modelStorageKey(provider)
  return (
    localStorage.getItem(key) ||
    (provider === 'claude' ? localStorage.getItem('rqg_model_claude') : null) ||
    localStorage.getItem('rqg_model') ||
    DEFAULT_MODEL_BY_PROVIDER[provider] ||
    DEFAULT_MODEL_BY_PROVIDER.claude
  )
}

export function loadStoredApiKeys() {
  return {
    claude: localStorage.getItem(API_KEY_STORAGE.claude) || '',
    gemini: localStorage.getItem(API_KEY_STORAGE.gemini) || '',
    deepseek: localStorage.getItem(API_KEY_STORAGE.deepseek) || '',
    grok: localStorage.getItem(API_KEY_STORAGE.grok) || '',
    cursor: localStorage.getItem(API_KEY_STORAGE.cursor) || '',
    openrouter: localStorage.getItem(API_KEY_STORAGE.openrouter) || '',
  }
}

/** @param {Array<{ value: string, label: string, group?: string }>} models */
export function groupModelsForSelect(models) {
  const groups = new Map()
  for (const m of models) {
    const g = m.group || 'Models'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(m)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => ({ group, items }))
}

const PROVIDER_META = {
  claude: {
    keyLabel: 'Anthropic API key',
    keyPlaceholder: 'sk-ant-...',
    keyMissing: 'Please enter your Anthropic API key.',
    keyHint: 'Saved locally. Sent only to your backend, then to Anthropic.',
  },
  gemini: {
    keyLabel: 'Google Gemini API key',
    keyPlaceholder: 'AIza…',
    keyMissing: 'Please enter your Google Gemini API key.',
    keyHint: 'Create a key in Google AI Studio. Sent only to your backend, then to Google.',
  },
  deepseek: {
    keyLabel: 'DeepSeek API key',
    keyPlaceholder: 'sk-...',
    keyMissing: 'Please enter your DeepSeek API key.',
    keyHint: 'From platform.deepseek.com. Sent only to your backend, then to DeepSeek.',
  },
  grok: {
    keyLabel: 'xAI Grok API key',
    keyPlaceholder: 'xai-...',
    keyMissing: 'Please enter your xAI Grok API key.',
    keyHint: 'From console.x.ai. Sent only to your backend, then to xAI.',
  },
  cursor: {
    keyLabel: 'Cursor API key',
    keyPlaceholder: 'key_...',
    keyMissing: 'Please enter your Cursor API key.',
    keyHint:
      'From Cursor Dashboard → API Keys (Cloud Agents). Sent only to your backend, then to api.cursor.com.',
  },
  openrouter: {
    keyLabel: 'OpenRouter API key',
    keyPlaceholder: 'sk-or-...',
    keyMissing: 'Please enter your OpenRouter API key.',
    keyHint:
      'One key for Claude, Gemini, GPT, DeepSeek, Grok, and more. From openrouter.ai — sent only to your backend.',
  },
}

export function getProviderMeta(provider) {
  return PROVIDER_META[provider] || PROVIDER_META.claude
}
