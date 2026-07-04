import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RondaPanel from './RondaPanel'

const players = [
  { name: 'A', token: 'tok-a' },
  { name: 'B', token: 'tok-b' },
  { name: 'C', token: 'tok-c' },
  { name: 'D', token: 'tok-d' },
  { name: 'E', token: 'tok-e' },
]

const baseProps = {
  players,
  currentMode: 'clasico' as const,
  currentDifficulty: 'dificil' as const,
  currentCategories: [],
  isLoading: false,
  onLaunch: vi.fn(),
  onCancel: vi.fn(),
}

describe('RondaPanel', () => {
  it('shows 6 mode options (no ciego)', () => {
    render(<RondaPanel {...baseProps} />)
    expect(screen.getByText('Clásico')).toBeInTheDocument()
    expect(screen.getByText('Caos')).toBeInTheDocument()
    expect(screen.getByText('Aliados')).toBeInTheDocument()
    expect(screen.getByText('Espejo')).toBeInTheDocument()
    expect(screen.getByText('Infiltrados')).toBeInTheDocument()
    expect(screen.getByText('Aleatorio')).toBeInTheDocument()
    expect(screen.queryByText('Ciego')).not.toBeInTheDocument()
  })

  it('disables Aliados button when fewer than 4 players', () => {
    render(<RondaPanel {...baseProps} players={players.slice(0, 3)} />)
    const aliadosBtn = screen.getByRole('button', { name: /aliados/i })
    expect(aliadosBtn).toBeDisabled()
  })

  it('does not disable Aliados with 4 players', () => {
    render(<RondaPanel {...baseProps} players={players.slice(0, 4)} />)
    const aliadosBtn = screen.getByRole('button', { name: /aliados/i })
    expect(aliadosBtn).not.toBeDisabled()
  })

  it('disables Infiltrados button when fewer than 5 players', () => {
    render(<RondaPanel {...baseProps} players={players.slice(0, 4)} />)
    const infiltradosBtn = screen.getByRole('button', { name: /infiltrados/i })
    expect(infiltradosBtn).toBeDisabled()
  })

  it('does not disable Infiltrados with 5 players', () => {
    render(<RondaPanel {...baseProps} players={players} />)
    const infiltradosBtn = screen.getByRole('button', { name: /infiltrados/i })
    expect(infiltradosBtn).not.toBeDisabled()
  })
})
