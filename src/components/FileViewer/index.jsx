import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from '../../context/ThemeContext.jsx'
import { useWorkspace } from '../../context/WorkspaceContext.jsx'
import {
  buildFileTree,
  defaultExpandedFolders,
  firstFileInTree,
  folderKey,
  getSortedEntries,
} from './tree.js'
import './index.css'

/** Normalize so tree selection / lookups match API keys that may use backslashes (Windows). */
function canonicalPath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

const FOLDER_TABS_ALL = [
  { key: 'prefilled', label: 'Prefilled' },
  { key: 'solution', label: 'Solution' },
  { key: 'tests', label: 'Tests' },
  { key: 'ideCoding', label: 'IDE JSON' },
]

const OPEN_BOOK_TABS = [{ key: 'solution', label: 'Solution' }]

function getFileList(tab, files) {
  if (tab === 'ideCoding') return ['question.json']
  const obj = files[tab] || {}
  return [...new Set(Object.keys(obj).map(canonicalPath))].sort()
}

function getFileContent(tab, filename, files) {
  if (tab === 'ideCoding') return JSON.stringify(files.ideCoding, null, 2)
  const obj = files[tab] || {}
  const want = canonicalPath(filename)
  for (const k of Object.keys(obj)) {
    if (canonicalPath(k) === want) return obj[k] ?? ''
  }
  return ''
}

function getPrismLanguage(ext, folderTab) {
  if (folderTab === 'ideCoding') return 'json'
  const e = (ext || '').toLowerCase()
  const map = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'markup',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
  }
  return map[e] || 'javascript'
}

const EDITOR_FONT = "12.5px 'JetBrains Mono', Consolas, Menlo, monospace"
const EDITOR_LINE_HEIGHT = 19.375
const EDITOR_H_PAD = 28

function measureEditorSize(text, viewportWidth) {
  const lines = String(text ?? '').split('\n')
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let maxW = 0
  if (ctx) {
    ctx.font = EDITOR_FONT
    for (const line of lines) {
      maxW = Math.max(maxW, ctx.measureText(line || ' ').width)
    }
  }
  return {
    width: Math.max(maxW + EDITOR_H_PAD, viewportWidth || 0, 320),
    height: Math.max(lines.length * EDITOR_LINE_HEIGHT + 32, 280),
  }
}

function HighlightedCodeEditor({ value, onChange, onBlur, readOnly, language, theme, fileKey }) {
  const scrollRef = useRef(null)
  const layerRef = useRef(null)
  const taRef = useRef(null)
  const backRef = useRef(null)
  const prismStyle = theme === 'light' ? oneLight : oneDark
  const text = String(value ?? '')

  const syncLayerHeights = useCallback(() => {
    const ta = taRef.current
    const back = backRef.current
    const layer = layerRef.current
    const sc = scrollRef.current
    if (!ta || !back) return

    const { width, height } = measureEditorSize(text, sc?.clientWidth ?? 0)

    if (layer) layer.style.minWidth = `${width}px`
    ta.style.width = `${width}px`
    ta.style.height = `${height}px`
    back.style.minWidth = `${width}px`
    back.style.minHeight = `${height}px`
  }, [text])

  const handleScroll = useCallback(() => {
    const sc = scrollRef.current
    const back = backRef.current
    if (!sc || !back) return
    back.style.transform = `translate(${-sc.scrollLeft}px, ${-sc.scrollTop}px)`
  }, [])

  const handleWheel = useCallback(
    (e) => {
      const sc = scrollRef.current
      if (!sc) return
      if (sc.scrollHeight <= sc.clientHeight && sc.scrollWidth <= sc.clientWidth) return
      sc.scrollTop += e.deltaY
      sc.scrollLeft += e.deltaX
      handleScroll()
      e.preventDefault()
    },
    [handleScroll],
  )

  useLayoutEffect(() => {
    syncLayerHeights()
    handleScroll()
  }, [fileKey, language, text, syncLayerHeights, handleScroll])

  useEffect(() => {
    const sc = scrollRef.current
    if (!sc || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      syncLayerHeights()
      handleScroll()
    })
    ro.observe(sc)
    return () => ro.disconnect()
  }, [syncLayerHeights, handleScroll])

  return (
    <div ref={scrollRef} className="fv-code-scroll" onScroll={handleScroll}>
      <div ref={layerRef} className="fv-code-layer">
        <div ref={backRef} className="fv-code-mirror-back" aria-hidden>
          <SyntaxHighlighter
            PreTag="div"
            language={language}
            style={prismStyle}
            showLineNumbers={false}
            wrapLines={false}
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              padding: '12px 12px 20px 14px',
              background: 'transparent',
              minHeight: '100%',
              fontSize: '12.5px',
              lineHeight: 1.55,
              whiteSpace: 'pre',
            }}
            codeTagProps={{
              style: {
                fontFamily: "'JetBrains Mono', 'Consolas', 'Menlo', monospace",
                fontSize: '12.5px',
                lineHeight: 1.55,
                whiteSpace: 'pre',
              },
            }}
          >
            {text}
          </SyntaxHighlighter>
        </div>
        <textarea
          ref={taRef}
          className="fv-code-textarea fv-code-textarea--overlay"
          spellCheck={false}
          readOnly={readOnly}
          value={text}
          onChange={onChange}
          onBlur={onBlur}
          onWheel={handleWheel}
          aria-label="Source editor"
        />
      </div>
    </div>
  )
}

function FileTreeRow({
  depth,
  prefix,
  node,
  expanded,
  toggleFolder,
  selectedPath,
  onSelectFile,
}) {
  const { dirs, files } = getSortedEntries(node)
  const pad = 10 + depth * 14

  return (
    <>
      {dirs.map(([name, child]) => {
        const fk = folderKey(prefix, name)
        const isOpen = expanded.has(fk)
        return (
          <div key={fk} className="fv-tree-folder">
            <button
              type="button"
              className="fv-tree-row fv-tree-row--folder"
              style={{ paddingLeft: `${pad}px` }}
              onClick={() => toggleFolder(fk)}
              aria-expanded={isOpen}
            >
              <span className={`fv-tree-chevron ${isOpen ? 'open' : ''}`} aria-hidden>
                ›
              </span>
              <span className="fv-tree-folder-icon" aria-hidden>
                {isOpen ? '📂' : '📁'}
              </span>
              <span className="fv-tree-label">{name}</span>
            </button>
            {isOpen && (
              <FileTreeRow
                depth={depth + 1}
                prefix={fk}
                node={child}
                expanded={expanded}
                toggleFolder={toggleFolder}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            )}
          </div>
        )
      })}
      {files.map((f) => (
        <button
          key={f.path}
          type="button"
          className={`fv-tree-row fv-tree-row--file ${
            canonicalPath(selectedPath) === canonicalPath(f.path) ? 'active' : ''
          }`}
          style={{ paddingLeft: `${pad + 14}px` }}
          onClick={() => onSelectFile(f.path)}
          title={f.path}
        >
          <span className="fv-tree-file-icon" aria-hidden>
            {fileGlyph(f.name)}
          </span>
          <span className="fv-tree-label">{f.name}</span>
        </button>
      ))}
    </>
  )
}

function fileGlyph(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  const g = { jsx: '⚛', tsx: '⚛', js: 'JS', ts: 'TS', json: '{}', css: '#', html: '<>', md: 'M↓' }
  return g[ext] || 'ƒ'
}

export default function FileViewer({ files, assessmentMode = 'topin_base', onSourceFileEdit }) {
  const { theme } = useTheme()
  const { fileViewerUi, setFileViewerUi } = useWorkspace()
  const isOpenBook = assessmentMode === 'open_book'
  const folderTabs = useMemo(
    () => (isOpenBook ? OPEN_BOOK_TABS : FOLDER_TABS_ALL),
    [isOpenBook],
  )
  const folderTab = fileViewerUi.folderTab
  const selectedPath = fileViewerUi.selectedPath
  const expandedFolders = useMemo(
    () => new Set(fileViewerUi.expandedFolderKeys || []),
    [fileViewerUi.expandedFolderKeys],
  )
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [ideDraft, setIdeDraft] = useState('')
  const [sourceDraft, setSourceDraft] = useState('')
  const sourceDraftKeyRef = useRef('')
  const ideDebounceRef = useRef(null)
  const sourceDebounceRef = useRef(null)

  const setFolderTab = useCallback(
    (tab) => setFileViewerUi((prev) => ({ ...prev, folderTab: tab })),
    [setFileViewerUi],
  )
  const setSelectedPath = useCallback(
    (path) => setFileViewerUi((prev) => ({ ...prev, selectedPath: path })),
    [setFileViewerUi],
  )
  const setExpandedFolders = useCallback(
    (updater) => {
      setFileViewerUi((prev) => {
        const current = new Set(prev.expandedFolderKeys || [])
        const next = typeof updater === 'function' ? updater(current) : updater
        return { ...prev, expandedFolderKeys: [...next] }
      })
    },
    [setFileViewerUi],
  )

  useEffect(() => {
    if (isOpenBook) setFolderTab('solution')
  }, [isOpenBook, setFolderTab])

  const fileList = useMemo(() => getFileList(folderTab, files), [folderTab, files])

  // Only path names, not file contents — `files` gets a new reference on every keystroke,
  // but the list of paths should not reset selection or the explorer until paths actually change.
  const fileStructureKey = useMemo(() => {
    const list = getFileList(folderTab, files)
    return `${folderTab}:${list.join('\x1e')}`
  }, [folderTab, files])

  const tree = useMemo(() => buildFileTree(fileList), [fileList])

  useEffect(() => {
    const list = getFileList(folderTab, files)
    setFileViewerUi((prev) => {
      const expanded =
        prev.expandedFolderKeys?.length > 0
          ? new Set(prev.expandedFolderKeys)
          : defaultExpandedFolders(list)
      let nextSelected = prev.selectedPath
      if (!nextSelected || !list.some((p) => canonicalPath(p) === canonicalPath(nextSelected))) {
        nextSelected = firstFileInTree(buildFileTree(list))
      }
      return {
        ...prev,
        expandedFolderKeys: [...expanded],
        selectedPath: nextSelected,
      }
    })
    // Only when folder tab or file paths change — not on every keystroke edit.
  }, [fileStructureKey, setFileViewerUi])

  useEffect(() => {
    if (folderTab === 'ideCoding' && files?.ideCoding) {
      setIdeDraft(JSON.stringify(files.ideCoding, null, 2))
    }
  }, [folderTab, files?.ideCoding])

  const activePath = useMemo(() => {
    if (selectedPath) {
      const sel = canonicalPath(selectedPath)
      if (fileList.some((p) => canonicalPath(p) === sel)) return sel
    }
    return firstFileInTree(tree)
  }, [selectedPath, fileList, tree])

  const editorKey = `${folderTab}:${activePath ?? ''}`
  useEffect(() => {
    if (folderTab === 'ideCoding') return
    const content = activePath ? getFileContent(folderTab, activePath, files) : ''
    if (sourceDraftKeyRef.current !== editorKey) {
      sourceDraftKeyRef.current = editorKey
      setSourceDraft(content)
    }
  }, [editorKey, folderTab, activePath, files])

  const fileBody =
    folderTab === 'ideCoding'
      ? ideDraft
      : activePath
        ? sourceDraft
        : ''

  const handleFolderTab = (tab) => {
    if (ideDebounceRef.current) {
      clearTimeout(ideDebounceRef.current)
      ideDebounceRef.current = null
    }
    if (sourceDebounceRef.current) {
      clearTimeout(sourceDebounceRef.current)
      sourceDebounceRef.current = null
    }
    setFolderTab(tab)
  }

  useEffect(() => {
    return () => {
      if (ideDebounceRef.current) clearTimeout(ideDebounceRef.current)
      if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current)
    }
  }, [])

  const handleIdeDraftChange = useCallback(
    (v) => {
      setIdeDraft(v)
      if (!onSourceFileEdit) return
      if (ideDebounceRef.current) clearTimeout(ideDebounceRef.current)
      ideDebounceRef.current = setTimeout(() => {
        ideDebounceRef.current = null
        try {
          JSON.parse(v)
          onSourceFileEdit('ideCoding', '', v)
        } catch {
          /* still typing invalid JSON */
        }
      }, 550)
    },
    [onSourceFileEdit],
  )

  const flushSourceSave = useCallback(() => {
    if (sourceDebounceRef.current) {
      clearTimeout(sourceDebounceRef.current)
      sourceDebounceRef.current = null
    }
    if (folderTab !== 'ideCoding' && activePath && onSourceFileEdit) {
      onSourceFileEdit(folderTab, activePath, sourceDraft)
    }
  }, [activePath, folderTab, onSourceFileEdit, sourceDraft])

  const handleFileBodyChange = useCallback(
    (e) => {
      const v = e.target.value
      if (folderTab === 'ideCoding') {
        handleIdeDraftChange(v)
        return
      }
      setSourceDraft(v)
      if (!activePath || !onSourceFileEdit) return
      if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current)
      sourceDebounceRef.current = setTimeout(() => {
        sourceDebounceRef.current = null
        onSourceFileEdit(folderTab, activePath, v)
      }, 200)
    },
    [activePath, folderTab, handleIdeDraftChange, onSourceFileEdit],
  )

  const toggleFolder = useCallback(
    (fk) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev)
        if (next.has(fk)) next.delete(fk)
        else next.add(fk)
        return next
      })
    },
    [setExpandedFolders],
  )

  const ext = activePath?.split('.').pop() || ''
  const langLabel =
    folderTab === 'ideCoding'
      ? 'JSON'
      : { jsx: 'JSX', js: 'JS', ts: 'TS', tsx: 'TSX', css: 'CSS', json: 'JSON', html: 'HTML', md: 'MD' }[ext] ||
        ext.toUpperCase() ||
        '—'

  const prismLang = getPrismLanguage(ext, folderTab)
  const editable = Boolean(onSourceFileEdit)

  return (
    <div className={`file-viewer fv-theme-${theme}`}>
      {folderTabs.length > 1 && (
        <div className="fv-folder-tabs">
          {folderTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`fv-folder-btn ${folderTab === t.key ? 'active' : ''}`}
              onClick={() => handleFolderTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className={`fv-body ${explorerCollapsed ? 'fv-body--collapsed' : ''}`}>
        <aside className="fv-explorer" aria-label="File explorer">
          <div className="fv-explorer-header">
            <span className="fv-explorer-title">EXPLORER</span>
            <button
              type="button"
              className="fv-explorer-collapse"
              onClick={() => setExplorerCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse explorer"
            >
              ⟨
            </button>
          </div>
          <div className="fv-explorer-scroll">
            {fileList.length === 0 ? (
              <p className="fv-explorer-empty">No files</p>
            ) : (
              <FileTreeRow
                depth={0}
                prefix=""
                node={tree}
                expanded={expandedFolders}
                toggleFolder={toggleFolder}
                selectedPath={activePath}
                onSelectFile={setSelectedPath}
              />
            )}
          </div>
        </aside>

        <button
          type="button"
          className="fv-explorer-rail"
          onClick={() => setExplorerCollapsed(false)}
          title="Show file explorer"
          aria-label="Expand explorer"
        >
          ⟩
        </button>

        <div className="fv-editor">
          <div className="fv-code-header">
            <span className="fv-file-path" title={folderTab === 'ideCoding' ? 'ideCoding' : activePath}>
              {folderTab === 'ideCoding' ? 'ideCoding (JSON)' : activePath || '—'}
            </span>
            <span className="fv-lang-badge">{langLabel}</span>
            {editable && (
              <span className="fv-edit-hint" title="Edits save automatically and update the live preview for solution files">
                Editable
              </span>
            )}
            <button
              type="button"
              className="fv-copy-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fileBody)
                } catch {
                  const ta = document.createElement('textarea')
                  ta.value = fileBody
                  ta.setAttribute('readonly', '')
                  ta.style.position = 'fixed'
                  ta.style.left = '-9999px'
                  document.body.appendChild(ta)
                  ta.select()
                  document.execCommand('copy')
                  document.body.removeChild(ta)
                }
              }}
              title="Copy entire file to clipboard"
            >
              Copy all
            </button>
          </div>
          <div className="fv-syntax-wrap fv-syntax-wrap--edit">
            {folderTab === 'ideCoding' || activePath ? (
              <HighlightedCodeEditor
                value={fileBody}
                onChange={handleFileBodyChange}
                onBlur={flushSourceSave}
                readOnly={!editable}
                language={prismLang}
                theme={theme}
                fileKey={`${folderTab}:${activePath ?? ''}`}
              />
            ) : (
              <p className="fv-syntax-empty">Select a file</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
