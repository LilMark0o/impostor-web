import type { ElementType } from 'react';
import { Shield, Layers, Users, Shuffle, Eye, Dices } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CategorySelector } from '@/components/CategorySelector';
import type { Mode, Difficulty } from '@/types';

interface StepModeProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  categories: string[];
  onCategoriesChange: (cats: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  playerCount?: number;
  showCategoryToImpostor?: boolean;
  onShowCategoryToImpostorChange?: (v: boolean) => void;
  showImpostorCount?: boolean;
  onShowImpostorCountChange?: (v: boolean) => void;
}

interface ModeCardDef {
  key: Mode;
  label: string;
  icon: ElementType;
  description: string;
  minPlayers?: number;
  minPlayersLabel?: string;
  special?: boolean;
}

const MODE_CARDS: ModeCardDef[] = [
  {
    key: 'clasico',
    label: 'Clásico',
    icon: Shield,
    description: 'Un impostor. No sabe la palabra.',
  },
  {
    key: 'caos',
    label: 'Caos',
    icon: Layers,
    description: 'Impostores aleatorios. Todos saben cuántos hay.',
  },
  {
    key: 'aliados',
    label: 'Aliados',
    icon: Users,
    description: '2 impostores que se conocen entre sí.',
    minPlayers: 4,
    minPlayersLabel: 'Necesitas 4+ jugadores',
  },
  {
    key: 'espejo',
    label: 'Espejo',
    icon: Shuffle,
    description: 'El impostor tiene una palabra diferente de la misma categoría.',
  },
  {
    key: 'infiltrados',
    label: 'Infiltrados',
    icon: Eye,
    description: '2 impostores con palabras distintas. No se conocen.',
    minPlayers: 5,
    minPlayersLabel: 'Necesitas 5+ jugadores',
  },
  {
    key: 'aleatorio',
    label: 'Aleatorio',
    icon: Dices,
    description: 'El destino elige. Puede pasar cualquier cosa.',
    special: true,
  },
];

interface DifficultyOption {
  key: Difficulty;
  label: string;
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { key: 'facil', label: 'Fácil' },
  { key: 'dificil', label: 'Difícil' },
  { key: 'brutal', label: 'Brutal' },
];

export function StepMode({
  mode,
  setMode,
  difficulty,
  setDifficulty,
  categories,
  onCategoriesChange,
  onBack,
  onNext,
  playerCount = 99,
  showCategoryToImpostor = true,
  onShowCategoryToImpostorChange,
  showImpostorCount = true,
  onShowImpostorCountChange,
}: StepModeProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <h2 className="text-2xl font-bold text-stone-900">Modo de juego</h2>

      {/* Mode grid — 2×3 */}
      <div className="grid grid-cols-2 gap-3">
        {MODE_CARDS.map(({ key, label, icon: Icon, description, minPlayers, minPlayersLabel, special }) => {
          const isDisabled = minPlayers !== undefined && playerCount < minPlayers;
          const isSelected = mode === key;

          let cardClass = 'rounded-lg border p-4 text-left transition-colors ';
          if (isDisabled) {
            cardClass += 'opacity-40 cursor-not-allowed ';
          } else {
            cardClass += 'cursor-pointer ';
          }
          if (isSelected && special) {
            cardClass += 'bg-amber-100 border-amber-500';
          } else if (isSelected) {
            cardClass += 'bg-amber-50 border-amber-600';
          } else if (special) {
            cardClass += 'bg-amber-50/50 border-amber-200 hover:bg-amber-50';
          } else {
            cardClass += 'bg-white border-stone-200 hover:bg-stone-50';
          }

          return (
            <button
              key={key}
              type="button"
              data-testid={`mode-card-${key}`}
              disabled={isDisabled}
              onClick={() => setMode(key)}
              className={cardClass}
            >
              <Icon size={24} className="mb-2 text-stone-700" />
              <p className="font-semibold text-stone-900">{label}</p>
              <p className="text-sm text-stone-500">{description}</p>
              {isDisabled && minPlayersLabel && (
                <p className="text-xs text-red-400 mt-1">{minPlayersLabel}</p>
              )}
              {isSelected && key === 'clasico' && (
                <div
                  className="flex items-center gap-2 mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label="Impostor ve la categoría"
                    checked={showCategoryToImpostor}
                    onChange={(e) => onShowCategoryToImpostorChange?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-stone-700">Impostor ve la categoría</span>
                </div>
              )}
              {isSelected && key === 'caos' && (
                <div
                  className="flex items-center gap-2 mt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label="Revelar número de impostores"
                    checked={showImpostorCount}
                    onChange={(e) => onShowImpostorCountChange?.(e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-sm text-stone-700">Revelar número de impostores</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Difficulty pill selector */}
      <div className="flex rounded-lg bg-stone-100 p-1 gap-1">
        {DIFFICULTY_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDifficulty(key)}
            className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
              difficulty === key
                ? 'bg-amber-600 text-white rounded-md'
                : 'bg-stone-100 text-stone-600 rounded-md hover:bg-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category selector — collapsible */}
      <CategorySelector value={categories} onChange={onCategoriesChange} />

      {/* Navigation buttons */}
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          ← Atrás
        </Button>
        <Button
          className="bg-stone-900 text-white hover:bg-stone-800"
          onClick={onNext}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}

export default StepMode;
