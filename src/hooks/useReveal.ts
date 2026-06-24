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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    if (!token) {
      setIsLoading(false)
      return
    }

    const clearPolling = () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const fetchState = async () => {
      try {
        const result = await getRevealState(token)
        if (!mountedRef.current) return
        setData(result)
        setError(null)
        if (result.state === 'ready') {
          clearPolling()
        }
      } catch (err) {
        if (!mountedRef.current) return
        setError(err instanceof Error ? err.message : 'Unknown error')
        clearPolling()
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    // Initial fetch
    fetchState()

    // Start polling interval
    intervalRef.current = setInterval(fetchState, POLL_INTERVAL)

    return () => {
      mountedRef.current = false
      clearPolling()
    }
  }, [token])

  return { data, error, isLoading }
}
