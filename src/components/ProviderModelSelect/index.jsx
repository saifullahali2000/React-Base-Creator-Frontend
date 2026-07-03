import { useProviderModels } from '../../hooks/useProviderModels.js'

export default function ProviderModelSelect({
  id,
  provider,
  model,
  onModelChange,
  apiKey,
  className = 'gen-input gen-select',
}) {
  const { grouped, loading, error, catalogPendingKey } = useProviderModels(provider, apiKey)

  const modelInList = grouped.some((g) => g.items.some((m) => m.value === model))

  return (
    <>
      <select
        id={id}
        className={className}
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={loading && (provider === 'openrouter' || provider === 'cursor')}
      >
        {!modelInList && model ? (
          <option value={model}>{model} (saved)</option>
        ) : null}
        {grouped.map(({ group, items }) => (
          <optgroup key={group} label={group}>
            {items.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {provider === 'openrouter' && loading && (
        <p className="gen-hint gen-hint-tight">Loading model catalog from OpenRouter…</p>
      )}
      {provider === 'cursor' && loading && (
        <p className="gen-hint gen-hint-tight">Loading model catalog from Cursor…</p>
      )}
      {catalogPendingKey && (
        <p className="gen-hint gen-hint-tight">
          Enter your Cursor API key below to load your full model list. Showing common defaults
          for now.
        </p>
      )}
      {provider === 'openrouter' && error && !catalogPendingKey && (
        <p className="gen-hint gen-hint-tight gen-hint-warn">Using fallback list — {error}</p>
      )}
      {provider === 'cursor' && error && !catalogPendingKey && (
        <p className="gen-hint gen-hint-tight gen-hint-warn">Using fallback list — {error}</p>
      )}
    </>
  )
}
