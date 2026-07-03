/** True when the backend hosts a real Vite preview (local :4000, Render /preview, etc.). */
export function isBackendHostedPreviewUrl(url) {
  return typeof url === 'string' && url.trim().length > 0
}

/** @deprecated use isBackendHostedPreviewUrl — kept for hosted-only checks */
export function isRemotePreviewUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const host = new URL(url.trim()).hostname.toLowerCase()
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
  } catch {
    return false
  }
}
