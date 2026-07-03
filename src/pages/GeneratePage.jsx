import GeneratorPanel from '../components/GeneratorPanel'
import ApiConnectionBanner from '../components/ApiConnectionBanner'
import { useWorkspace } from '../context/WorkspaceContext.jsx'

export default function GeneratePage() {
  const { handleGenerate, getGenerateFlow } = useWorkspace()
  const { isGenerating, status, error } = getGenerateFlow('topin_base')

  return (
    <div className="page page--generate">
      <header className="page-hero">
        <p className="page-hero-kicker">Assessment builder</p>
        <p className="page-route-subtitle">
          Full IDE question: prefilled starter, solution, tests, and portal-style ZIP layout.
        </p>
      </header>
      <div className="surface-card surface-card--padded surface-card--workspace">
        <ApiConnectionBanner />
        <GeneratorPanel
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          status={status}
          error={error}
        />
      </div>
    </div>
  )
}
