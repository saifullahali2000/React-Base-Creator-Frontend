import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

const NAV = [
  { to: '/topin-base', label: 'Topin base', icon: '◆', desc: 'Full IDE question' },
  { to: '/open-book', label: 'Open book', icon: '◇', desc: 'Solution only' },
  { to: '/preview', label: 'Preview', icon: '▣', desc: 'Live output' },
]

function pageTitle(pathname) {
  if (pathname.startsWith('/open-book')) return 'Open book'
  if (pathname.startsWith('/preview')) return 'Preview'
  return 'Topin base'
}

export default function AppShell() {
  const { pathname } = useLocation()
  const { toggleTheme, isDark } = useTheme()
  const {
    isGenerating,
    generatingMode,
    restoring,
    busy,
    generatedFiles,
    sessionId,
    hasActiveOutput,
  } = useWorkspace()

  const isPreviewRoute = pathname.startsWith('/preview')

  const appStateClass = [
    isGenerating && 'app--generating',
    restoring && 'app--restoring',
    busy && 'app--busy',
    hasActiveOutput && 'app--has-output',
    isPreviewRoute && 'app--on-preview',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`app ${appStateClass}`}>
      <div className="app-bg" aria-hidden="true" />
      <div className="app-shell">
        <aside className="app-sidebar" aria-label="Application">
          <div className="sidebar-brand">
            <Link to="/topin-base" className="sidebar-brand-link">
              <span className="sidebar-brand-mark" aria-hidden>
                R
              </span>
              <span className="sidebar-brand-text">
                <span className="sidebar-brand-title">React Creator</span>
                <span className="sidebar-brand-sub">Question studio</span>
              </span>
            </Link>
          </div>

          <nav className="sidebar-nav" aria-label="Main">
            {NAV.map(({ to, label, icon, desc }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-nav-link${isActive ? ' active' : ''}`}
              >
                <span className="sidebar-nav-icon" aria-hidden>
                  {icon}
                </span>
                <span className="sidebar-nav-copy">
                  <span className="sidebar-nav-label">{label}</span>
                  <span className="sidebar-nav-desc">{desc}</span>
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-foot">
            <button
              type="button"
              className="sidebar-theme-btn"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <span className="sidebar-theme-icon" aria-hidden>
                {isDark ? '☀' : '☾'}
              </span>
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            <div className="topbar-left">
              <span className="topbar-eyebrow">Workspace</span>
              <h1 className="topbar-title">{pageTitle(pathname)}</h1>
            </div>
            <div className="topbar-right">
              {isGenerating && (
                <span className="header-badge generating">
                  <span className="header-badge-dot" />
                  {generatingMode === 'open_book' ? 'Generating · Open book' : 'Generating · Topin base'}
                </span>
              )}
              {restoring && (
                <span className="header-badge generating">
                  <span className="header-badge-dot" />
                  Restoring session
                </span>
              )}
              {!isGenerating && !restoring && generatedFiles && sessionId && (
                <span className="header-badge ready">
                  <span className="header-badge-dot" />
                  Ready to preview
                </span>
              )}
            </div>
          </header>

          <main className="app-outlet-wrap">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
