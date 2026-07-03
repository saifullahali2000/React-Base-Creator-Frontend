/** Same formula as backend — keeps frontend-only rows in sync before the API responds. */
export function estimateTextTokens(text) {
  if (!text || typeof text !== 'string') return 0
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.ceil(trimmed.length / 4)
}

export function estimateImageTokens(width, height) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return 1024
  }
  if (w <= 512 && h <= 512) return 512
  return Math.ceil((w * h) / 750)
}

export function formatTokenCount(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString()
}

/** Read natural width/height from an image file for vision token estimates. */
export function readImageDimensions(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: img.naturalWidth || 1024,
        height: img.naturalHeight || 768,
        bytes: file.size,
      })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 1024, height: 768, bytes: file.size })
    }
    img.src = url
  })
}
