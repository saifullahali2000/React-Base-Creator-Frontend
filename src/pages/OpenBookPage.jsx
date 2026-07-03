import OpenBookPanel from '../components/OpenBookPanel'
import ApiConnectionBanner from '../components/ApiConnectionBanner'
import { useWorkspace } from '../context/WorkspaceContext.jsx'

export default function OpenBookPage() {
  const { handleGenerate, getGenerateFlow } = useWorkspace()
  const { isGenerating, status, error } = getGenerateFlow('open_book')

  return (
    <div className="page page--generate">
      <header className="page-hero">
        <p className="page-hero-kicker">Reference solution</p>
        <p className="page-route-subtitle">
          Solution-only export — no prefilled project and no test suite.
        </p>
      </header>
      <div className="surface-card surface-card--padded surface-card--workspace">
        <ApiConnectionBanner />
        <OpenBookPanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          status={status}
          error={error}
        />
      </div>
    </div>
  )
}
