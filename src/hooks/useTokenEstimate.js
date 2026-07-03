import { useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../config.js'
import { readApiError } from '../utils/apiError.js'
import { estimateImageTokens, estimateTextTokens } from '../utils/tokenEstimate.js'

const DEBOUNCE_MS = 350

function localFrontendEstimate({ functionality, appApiBaseUrls, appApiEndpoints, screenshots }) {
  const functionalityTokens = estimateTextTokens(functionality)
  const basesTokens = estimateTextTokens(appApiBaseUrls)
  const endpointsTokens = estimateTextTokens(appApiEndpoints)
  const perImage = (screenshots || []).map((s) =>
    estimateImageTokens(s.width, s.height)
  )
  const imageTokens = perImage.reduce((sum, n) => sum + n, 0)

  return {
    frontend: {
      functionality: functionalityTokens,
      appApiBaseUrls: basesTokens,
      appApiEndpoints: endpointsTokens,
      subtotal: functionalityTokens + basesTokens + endpointsTokens,
    },
    images: {
      count: perImage.length,
      perImage,
      subtotal: imageTokens,
    },
  }
}

export default function useTokenEstimate({
  assessmentMode,
  testCaseCount,
  functionality,
  appApiBaseUrls,
  appApiEndpoints,
  screenshots,
}) {
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const local = useMemo(
    () =>
      localFrontendEstimate({
        functionality,
        appApiBaseUrls,
        appApiEndpoints,
        screenshots,
      }),
    [functionality, appApiBaseUrls, appApiEndpoints, screenshots]
  )

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const payload = {
          assessmentMode,
          testCaseCount,
          functionality: functionality.trim(),
          appApiBaseUrls: appApiBaseUrls.trim(),
          appApiEndpoints: appApiEndpoints.trim(),
          hasScreenshots: screenshots.length > 0,
          screenshots: screenshots.map((s) => ({
            width: s.width,
            height: s.height,
            bytes: s.bytes ?? s.file?.size,
          })),
        }

        const res = await fetch(apiUrl('/api/estimate-tokens'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        if (!res.ok) {
          throw new Error(await readApiError(res, 'Estimate failed'))
        }

        const data = await res.json()
        setEstimate(data)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message)
        setEstimate(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [
    assessmentMode,
    testCaseCount,
    functionality,
    appApiBaseUrls,
    appApiEndpoints,
    screenshots,
  ])

  const display = estimate
    ? {
        ...estimate,
        frontend: estimate.frontend,
        images: estimate.images,
        totalInputTokens:
          estimate.backend.subtotal + estimate.images.subtotal,
      }
    : {
        backend: null,
        frontend: local.frontend,
        images: local.images,
        totalInputTokens: local.frontend.subtotal + local.images.subtotal,
        partial: true,
      }

  return { estimate: display, loading, error, local }
}
