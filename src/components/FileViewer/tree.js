export function buildFileTree(paths) {
  const root = { dirs: new Map(), files: [] }
  for (const fullPath of paths) {
    const parts = String(fullPath).split('/').filter(Boolean)
    if (!parts.length) continue
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      if (i === parts.length - 1) {
        cur.files.push({ name: seg, path: fullPath })
      } else {
        if (!cur.dirs.has(seg)) {
          cur.dirs.set(seg, { dirs: new Map(), files: [] })
        }
        cur = cur.dirs.get(seg)
      }
    }
  }
  return root
}

export function getSortedEntries(node) {
  const dirs = [...node.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name))
  return { dirs, files }
}

export function firstFileInTree(node) {
  const { dirs, files } = getSortedEntries(node)
  for (const [, child] of dirs) {
    const p = firstFileInTree(child)
    if (p) return p
  }
  if (files.length) return files[0].path
  return null
}

export function folderKey(prefix, name) {
  return prefix ? `${prefix}/${name}` : name
}

export function defaultExpandedFolders(paths) {
  const set = new Set()
  for (const fullPath of paths) {
    const parts = String(fullPath).split('/').filter(Boolean)
    for (let i = 0; i < parts.length - 1; i++) {
      set.add(parts.slice(0, i + 1).join('/'))
    }
  }
  return set
}
