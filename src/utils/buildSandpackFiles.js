/**
 * Map generated solution files to Sandpack virtual file tree.
 * @param {Record<string, string> | null | undefined} solution
 */
import { injectSandpackPreviewShims } from './sandpackPreviewShims.js'

/** react-router-dom v6 warns without v7 future flags; patch generated JSX before preview. */
export function patchReactRouterFutureFlags(source) {
  if (!source || typeof source !== 'string' || !/<BrowserRouter\b/.test(source)) return source
  if (/\bfuture\s*=\s*\{/.test(source)) return source
  return source.replace(
    /<BrowserRouter(?![^>]*\bfuture=)([^>]*)>/g,
    '<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}$1>',
  )
}

/**
 * @param {Record<string, string> | null | undefined} solution
 * @param {{ apiBaseUrl?: string }} [options]
 */
export function buildSandpackFiles(solution, options = {}) {
  if (!solution || typeof solution !== 'object' || !Object.keys(solution).length) {
    return null
  }

  /** @type {Record<string, { code: string; hidden?: boolean }>} */
  const files = {}

  for (const [path, content] of Object.entries(solution)) {
    if (typeof content !== 'string') continue
    const key = path.startsWith('/') ? path : `/${path.replace(/\\/g, '/')}`
    const code = /\.(jsx|tsx|js)$/i.test(path) ? patchReactRouterFutureFlags(content) : content
    files[key] = { code }
  }

  const hasMain = Boolean(files['/src/main.jsx'] || files['/src/main.js'] || files['/src/main.tsx'])
  if (!hasMain) {
    files['/src/main.jsx'] = {
      code: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    }
  }

  if (!files['/index.html']) {
    files['/index.html'] = {
      code: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
      hidden: true,
    }
  }

  injectSandpackPreviewShims(files, options)

  const defaultPkg = {
    name: 'rqg-preview',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      start: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router': '^7.12.0',
      'react-router-dom': '^7.11.0',
      'js-cookie': '^3.0.5',
    },
    devDependencies: {
      '@vitejs/plugin-react': '3.1.0',
      vite: '4.1.4',
      'esbuild-wasm': '0.17.12',
    },
  }

  let pkg = defaultPkg
  const existingPkg = files['/package.json']?.code
  if (existingPkg) {
    try {
      const parsed = JSON.parse(existingPkg)
      pkg = {
        ...defaultPkg,
        ...parsed,
        scripts: { ...defaultPkg.scripts, ...(parsed.scripts || {}) },
        dependencies: { ...defaultPkg.dependencies, ...(parsed.dependencies || {}) },
        devDependencies: { ...defaultPkg.devDependencies, ...(parsed.devDependencies || {}) },
      }
      // Sandpack nodebox only supports its pinned in-browser Vite toolchain.
      pkg.devDependencies.vite = defaultPkg.devDependencies.vite
      pkg.devDependencies['@vitejs/plugin-react'] = defaultPkg.devDependencies['@vitejs/plugin-react']
      pkg.devDependencies['esbuild-wasm'] = defaultPkg.devDependencies['esbuild-wasm']
      pkg.dependencies.react = defaultPkg.dependencies.react
      pkg.dependencies['react-dom'] = defaultPkg.dependencies['react-dom']
    } catch {
      pkg = defaultPkg
    }
  }

  const sourceBlob = Object.entries(files)
    .filter(([k]) => k !== '/package.json' && /\.(jsx|js|tsx|ts)$/i.test(k))
    .map(([, f]) => f?.code || '')
    .join('\n')
  if (/from\s+['"]prop-types['"]/.test(sourceBlob)) {
    pkg.dependencies['prop-types'] = '^15.8.1'
  }

  files['/package.json'] = {
    code: JSON.stringify(pkg, null, 2),
    hidden: true,
  }

  return files
}
