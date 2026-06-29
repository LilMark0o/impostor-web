import { renderHook, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useReveal } from '../useReveal'
import * as revealApi from '../../api/reveal'
import type { RevealState } from '../../types'

const waitingState: RevealState = {
  state: 'waiting',
  player_name: 'Marco',
}

const readyState: RevealState = {
  state: 'ready',
  player_name: 'Marco',
  session_id: 'sess-1',
  is_impostor: false,
  category: 'Animals',
}

describe('useReveal', () => {
  beforeEach(() => {
    vi.spyOn(revealApi, 'getRevealState')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts with isLoading: true and resolves to false after first fetch', async () => {
    vi.mocked(revealApi.getRevealState).mockResolvedValue(readyState)

    const { result } = renderHook(() => useReveal('tok-1'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeNull()

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual(readyState)
  })

  it('returns data from the API on success', async () => {
    vi.mocked(revealApi.getRevealState).mockResolvedValue(readyState)

    const { result } = renderHook(() => useReveal('tok-1'))

    await waitFor(() => expect(result.current.data).toEqual(readyState))
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('sets error when fetch throws', async () => {
    vi.mocked(revealApi.getRevealState).mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useReveal('tok-1'))

    await waitFor(() => expect(result.current.error).toBe('Network error'))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('continues polling even when state is ready', async () => {
    vi.mocked(revealApi.getRevealState).mockResolvedValue(readyState)
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const { result } = renderHook(() => useReveal('tok-1'))

    await waitFor(() => expect(result.current.data?.state).toBe('ready'))
    expect(revealApi.getRevealState).toHaveBeenCalledTimes(1)

    // Advance time beyond one interval — polling should continue
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(revealApi.getRevealState).toHaveBeenCalledTimes(2))
  })

  it('continues polling while state is waiting', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(revealApi.getRevealState)
      .mockResolvedValueOnce(waitingState)
      .mockResolvedValueOnce(waitingState)
      .mockResolvedValue(readyState)

    const { result } = renderHook(() => useReveal('tok-1'))

    // Wait for initial fetch
    await waitFor(() => expect(result.current.data?.state).toBe('waiting'))
    expect(revealApi.getRevealState).toHaveBeenCalledTimes(1)

    // Advance one interval — triggers second call
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(revealApi.getRevealState).toHaveBeenCalledTimes(2))

    // Advance another interval — third call returns ready
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(result.current.data?.state).toBe('ready'))
    expect(revealApi.getRevealState).toHaveBeenCalledTimes(3)

    // With continuous polling, advancing further triggers more calls
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(revealApi.getRevealState).toHaveBeenCalledTimes(4))
  })

  it('updates data when session_id changes (new round)', async () => {
    const round2State: RevealState = {
      state: 'ready',
      player_name: 'Marco',
      session_id: 'sess-2',
      is_impostor: true,
      category: null,
    }
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(revealApi.getRevealState)
      .mockResolvedValueOnce(readyState)
      .mockResolvedValue(round2State)

    const { result } = renderHook(() => useReveal('tok-1'))

    await waitFor(() => expect(result.current.data?.session_id).toBe('sess-1'))

    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    await waitFor(() => expect(result.current.data?.session_id).toBe('sess-2'))
    expect(result.current.data?.is_impostor).toBe(true)
  })
})
