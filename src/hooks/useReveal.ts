import { useState, useEffect, useRef } from 'react'
import type { RevealState } from '../types'
import { getRevealState } from '../api/reveal'

const POLL_INTERVAL = 3000

export function useReveal(token: string): {
  data: RevealState | null
  error: string | null
  isLoading: boolean
} {
  const [data, setData] = useState<RevealState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    const abortController = new AbortController()
    setIsLoading(true)

    const clearPolling = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const fetchState = async () => {
      if (abortController.signal.aborted) return
      try {
        const result = await getRevealState(token)
        if (abortController.signal.aborted) return
        setData(result)
        setError(null)
      } catch (err) {
        if (abortController.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Error al obtener estado')
        clearPolling()
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    // Initial fetch
    fetchState()

    // Start polling interval
    intervalRef.current = setInterval(fetchState, POLL_INTERVAL)

    return () => {
      abortController.abort()
      clearPolling()
    }
  }, [token])

  return { data, error, isLoading }
}
