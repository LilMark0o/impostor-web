import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getStoredTokens,
  saveTokens,
  clearStoredTokens,
  getStoredCategories,
  saveCategories,
  clearStoredCategories,
} from '../playerTokens'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('token storage', () => {
  it('returns [] when nothing stored', () => {
    expect(getStoredTokens()).toEqual([])
  })

  it('saves and retrieves tokens', () => {
    saveTokens([{ name: 'Marco', token: 'abc-123' }])
    expect(getStoredTokens()).toEqual([{ name: 'Marco', token: 'abc-123' }])
  })

  it('ignores entries with empty token', () => {
    saveTokens([
      { name: 'Marco', token: 'abc-123' },
      { name: 'Ghost', token: '' },
    ])
    expect(getStoredTokens()).toEqual([{ name: 'Marco', token: 'abc-123' }])
  })

  it('clearStoredTokens removes the key', () => {
    saveTokens([{ name: 'Marco', token: 'abc-123' }])
    clearStoredTokens()
    expect(getStoredTokens()).toEqual([])
  })
})

describe('category storage', () => {
  it('returns [] when nothing stored', () => {
    expect(getStoredCategories()).toEqual([])
  })

  it('saves and retrieves categories', () => {
    saveCategories(['animal', 'país'])
    expect(getStoredCategories()).toEqual(['animal', 'país'])
  })

  it('clearStoredCategories removes the key', () => {
    saveCategories(['animal'])
    clearStoredCategories()
    expect(getStoredCategories()).toEqual([])
  })
})
