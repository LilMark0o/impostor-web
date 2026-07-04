import { useState } from 'react'
import { Shield, Layers, Users, Shuffle, Eye } from 'lucide-react'
import { CategorySelector } from './CategorySelector'
import type { Mode, Difficulty, PlayerTokenOut } from '@/types'
import { cn } from '@/lib/utils'

export interface RondaLaunchConfig {
  mode: Mode
  difficulty: Difficulty
  categories: string[]
  players: { name: string; token: string }[]
  showCategoryToImpostor: boolean
  showImpostorCount: boolean
}

interface RondaPanelProps {
  players: PlayerTokenOut[]
  currentMode: Mode
  currentDifficulty: Difficulty
  currentCategories: string[]
  isLoading: boolean
  onLaunch: (config: RondaLaunchConfig) => void
  onCancel: () => void
}

const MODE_OPTIONS: {
  key: Mode
  label: string
  icon: React.ElementType
  minPlayers?: number
}[] = [
  { key: 'clasico',     label: 'Clásico',     icon: Shield },
  { key: 'caos',        label: 'Caos',        icon: Layers },
  { key: 'aliados',     label: 'Aliados',     icon: Users,   minPlayers: 4 },
  { key: 'espejo',      label: 'Espejo',      icon: Shuffle },
  { key: 'infiltrados', label: 'Infiltrados', icon: Eye,     minPlayers: 5 },
  { key: 'aleatorio',   label: 'Aleatorio',   icon: Shuffle },
]

const DIFFICULTY_OPTIONS: { key: Difficulty; label: string }[] = [
  { key: 'facil', label: 'Fácil' },
  { key: 'dificil', label: 'Difícil' },
  { key: 'brutal', label: 'Brutal' },
]

export function RondaPanel({
  players: initialPlayers,
  currentMode,
  currentDifficulty,
  currentCategories,
  isLoading,
  onLaunch,
  onCancel,
}: RondaPanelProps) {
  const [rondaPlayers, setRondaPlayers] = useState<{ name: string; token: string }[]>(initialPlayers)
  const [editingPlayers, setEditingPlayers] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [rondaMode, setRondaMode] = useState<Mode>(currentMode)
  const [rondaDifficulty, setRondaDifficulty] = useState<Difficulty>(currentDifficulty)
  const [rondaCategories, setRondaCategories] = useState<string[]>(currentCategories)
  const [showCategoryToImpostor, setShowCategoryToImpostor] = useState(true)
  const [showImpostorCount, setShowImpostorCount] = useState(true)

  function addPlayer() {
    const name = newPlayerName.trim()
    if (!name || rondaPlayers.some((p) => p.name === name)) return
    setRondaPlayers((prev) => [...prev, { name, token: '' }])
    setNewPlayerName('')
  }

  function removePlayer(name: string) {
    setRondaPlayers((prev) => prev.filter((p) => p.name !== name))
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-stone-900">Nueva ronda</h2>
        <button type="button" onClick={onCancel} className="text-sm text-stone-400 hover:text-stone-700 transition-colors">
          ← Volver
        </button>
      </div>

      {/* Players */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Jugadores</span>
          <button
            type="button"
            onClick={() => setEditingPlayers((e) => !e)}
            className="text-xs text-amber-600 hover:text-amber-800 transition-colors"
          >
            {editingPlayers ? 'Listo' : '+ agregar / editar'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {rondaPlayers.map((p) => (
            <span
              key={p.name}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-stone-100 text-stone-700 border border-stone-200"
            >
              {p.name}
              {editingPlayers && (
                <button
                  type="button"
                  onClick={() => removePlayer(p.name)}
                  className="text-stone-400 hover:text-red-500 ml-1"
                  aria-label={`Eliminar ${p.name}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        {editingPlayers && (
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              placeholder="Nombre del jugador"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={addPlayer}
              className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800 transition-colors"
            >
              Agregar
            </button>
          </div>
        )}
      </div>

      {/* Mode */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Modo</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {MODE_OPTIONS.map(({ key, label, icon: Icon, minPlayers }) => {
            const isDisabled = minPlayers !== undefined && rondaPlayers.length < minPlayers
            return (
              <button
                key={key}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setRondaMode(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                  isDisabled
                    ? 'cursor-not-allowed opacity-40 bg-white border-stone-200 text-stone-600'
                    : rondaMode === key
                    ? 'bg-amber-50 border-amber-600 text-amber-800'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50',
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Difficulty */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Dificultad</span>
        <div className="flex rounded-lg bg-stone-100 p-1 gap-1 mt-2">
          {DIFFICULTY_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRondaDifficulty(key)}
              className={cn(
                'flex-1 py-1.5 text-sm font-medium transition-colors rounded-md',
                rondaDifficulty === key
                  ? 'bg-amber-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <CategorySelector value={rondaCategories} onChange={setRondaCategories} />

      {/* Launch button */}
      <button
        type="button"
        disabled={isLoading || rondaPlayers.length < 2}
        onClick={() => onLaunch({ mode: rondaMode, difficulty: rondaDifficulty, categories: rondaCategories, players: rondaPlayers, showCategoryToImpostor, showImpostorCount })}
        className="w-full rounded-lg bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Lanzando...' : 'LANZAR RONDA'}
      </button>
    </div>
  )
}

export default RondaPanel
