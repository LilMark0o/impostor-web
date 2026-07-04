import { describe, it, expect } from 'vitest'
import { computeImpostors } from './StepReview'

describe('computeImpostors', () => {
  it('clasico always returns 1', () => {
    expect(computeImpostors(3, 'clasico')).toBe('1')
    expect(computeImpostors(10, 'clasico')).toBe('1')
  })

  it('caos returns range based on floor(n/2)', () => {
    expect(computeImpostors(3, 'caos')).toBe('1')   // floor(3/2)=1
    expect(computeImpostors(4, 'caos')).toBe('1–2') // floor(4/2)=2
    expect(computeImpostors(6, 'caos')).toBe('1–3') // floor(6/2)=3
  })

  it('aliados always returns 2', () => {
    expect(computeImpostors(4, 'aliados')).toBe('2')
  })

  it('espejo returns range same as caos', () => {
    expect(computeImpostors(4, 'espejo')).toBe('1–2')
  })

  it('infiltrados always returns 2', () => {
    expect(computeImpostors(5, 'infiltrados')).toBe('2')
  })

  it('aleatorio returns ?', () => {
    expect(computeImpostors(5, 'aleatorio')).toBe('?')
  })

  it('sin_impostores returns 0', () => {
    expect(computeImpostors(5, 'sin_impostores')).toBe('0')
  })

  it('todos_impostores returns todos', () => {
    expect(computeImpostors(5, 'todos_impostores')).toBe('todos')
  })
})
