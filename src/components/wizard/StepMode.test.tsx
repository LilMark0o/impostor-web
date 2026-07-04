import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepMode from './StepMode'

const baseProps = {
  mode: 'clasico' as const,
  setMode: vi.fn(),
  difficulty: 'dificil' as const,
  setDifficulty: vi.fn(),
  categories: [],
  onCategoriesChange: vi.fn(),
  onBack: vi.fn(),
  onNext: vi.fn(),
  playerCount: 5,
  showCategoryToImpostor: true,
  onShowCategoryToImpostorChange: vi.fn(),
  showImpostorCount: true,
  onShowImpostorCountChange: vi.fn(),
}

describe('StepMode', () => {
  it('renders all 6 mode cards', () => {
    render(<StepMode {...baseProps} />)
    expect(screen.getByText('Clásico')).toBeInTheDocument()
    expect(screen.getByText('Caos')).toBeInTheDocument()
    expect(screen.getByText('Aliados')).toBeInTheDocument()
    expect(screen.getByText('Espejo')).toBeInTheDocument()
    expect(screen.getByText('Infiltrados')).toBeInTheDocument()
    expect(screen.getByText('Aleatorio')).toBeInTheDocument()
  })

  it('disables Aliados card when playerCount < 4', () => {
    render(<StepMode {...baseProps} playerCount={3} />)
    const aliadosCard = screen.getByTestId('mode-card-aliados')
    expect(aliadosCard).toBeDisabled()
  })

  it('enables Aliados card when playerCount >= 4', () => {
    render(<StepMode {...baseProps} playerCount={4} />)
    const aliadosCard = screen.getByTestId('mode-card-aliados')
    expect(aliadosCard).not.toBeDisabled()
  })

  it('disables Infiltrados card when playerCount < 5', () => {
    render(<StepMode {...baseProps} playerCount={4} />)
    const infiltradosCard = screen.getByTestId('mode-card-infiltrados')
    expect(infiltradosCard).toBeDisabled()
  })

  it('enables Infiltrados card when playerCount >= 5', () => {
    render(<StepMode {...baseProps} playerCount={5} />)
    const infiltradosCard = screen.getByTestId('mode-card-infiltrados')
    expect(infiltradosCard).not.toBeDisabled()
  })

  it('shows category toggle when clasico is selected', () => {
    render(<StepMode {...baseProps} mode="clasico" />)
    expect(screen.getByLabelText('Impostor ve la categoría')).toBeInTheDocument()
  })

  it('shows impostor-count toggle when caos is selected', () => {
    render(<StepMode {...baseProps} mode="caos" />)
    expect(screen.getByLabelText('Revelar número de impostores')).toBeInTheDocument()
  })

  it('calls onShowCategoryToImpostorChange when category toggle clicked', async () => {
    const handler = vi.fn()
    render(
      <StepMode
        {...baseProps}
        mode="clasico"
        onShowCategoryToImpostorChange={handler}
        showCategoryToImpostor={true}
      />,
    )
    await userEvent.click(screen.getByLabelText('Impostor ve la categoría'))
    expect(handler).toHaveBeenCalledWith(false)
  })
})
