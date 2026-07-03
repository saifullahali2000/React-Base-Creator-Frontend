/**
 * Parse a failed fetch response into a user-facing message.
 * @param {Response} res
 * @param {string} fallback
 */
export async function readApiError(res, fallback) {
  const text = await res.text().catch(() => '')
  if (text) {
    try {
      const body = JSON.parse(text)
      if (body?.error) return String(body.error)
    } catch {
      if (/FUNCTION_INVOCATION_FAILED|INTERNAL_SERVER_ERROR/i.test(text)) {
        return 'API server crashed (500). Redeploy the backend or fix VITE_API_BASE_URL in your frontend build.'
      }
    }
  }
  return `${fallback} (${res.status})`
}
