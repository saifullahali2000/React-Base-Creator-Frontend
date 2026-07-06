import { formatTokenCount } from '../../utils/tokenEstimate.js'
import './index.css'

function Row({ label, value, muted }) {
  return (
    <div className={`token-est-row ${muted ? 'token-est-row--muted' : ''}`}>
      <span className="token-est-label">{label}</span>
      <span className="token-est-value">{formatTokenCount(value)}</span>
    </div>
  )
}

export default function TokenEstimateBar({ estimate, loading, error, partial }) {
  const backend = estimate?.backend
  const frontend = estimate?.frontend
  const images = estimate?.images
  const total = estimate?.totalInputTokens ?? 0

  return (
    <section className="token-est" aria-live="polite">
      <div className="token-est-head">
        <h3 className="token-est-title">Estimated input tokens</h3>
        <span className="token-est-total" title="Approximate tokens sent to the model">
          {loading && !backend ? '…' : formatTokenCount(total)}
          {loading && backend ? <span className="token-est-pulse" aria-hidden> ↻</span> : null}
        </span>
      </div>

      {error ? (
        <p className="token-est-error">{error}</p>
      ) : (
        <div className="token-est-grid">
          <div className="token-est-col">
            <h4 className="token-est-col-title">Backend prompt</h4>
            {backend ? (
              <>
                <Row label="System prompt (total)" value={backend.systemPrompt} />
                <Row
                  label="README template (in system)"
                  value={backend.readmeTemplate ?? 0}
                />
                <Row label="Other system rules" value={backend.systemPromptWithoutReadme ?? 0} muted />
                <Row label="Prompt template" value={backend.promptWrapper} muted />
                <Row label="User message (built)" value={backend.userRequestTotal} />
                {estimate?.promptMeta && !estimate.promptMeta.readmeLoaded ? (
                  <p className="token-est-warn">
                    README template not loaded on this backend — redeploy with Sample_Folder or run locally.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="token-est-wait">Waiting for backend estimate…</p>
            )}
          </div>

          <div className="token-est-col">
            <h4 className="token-est-col-title">Your form input</h4>
            <Row label="Functionality" value={frontend?.functionality} />
            <Row label="API base URLs" value={frontend?.appApiBaseUrls} />
            <Row label="API endpoints" value={frontend?.appApiEndpoints} />
            <Row label="Form subtotal" value={frontend?.subtotal} />
          </div>

          <div className="token-est-col">
            <h4 className="token-est-col-title">Screenshots</h4>
            {images?.count > 0 ? (
              <>
                <Row label={`${images.count} image(s)`} value={images.subtotal} />
                {images.perImage?.length > 1 && (
                  <p className="token-est-hint">
                    {images.perImage.map((n, i) => `#${i + 1}: ${formatTokenCount(n)}`).join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <Row label="No images" value={0} muted />
            )}
          </div>
        </div>
      )}

      <p className="token-est-footnote">
        {partial && !backend
          ? 'Frontend fields update instantly; backend system prompt loads from the API.'
          : 'Approximate input size before generation (text ≈ chars÷4, images ≈ pixels÷750). Output tokens are not included.'}
      </p>
    </section>
  )
}
