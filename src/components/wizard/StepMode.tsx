import type { ElementType } from 'react';
import { Shield, Layers, EyeOff, Users, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Mode, Difficulty } from '@/types';

interface StepModeProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  onBack: () => void;
  onNext: () => void;
}

interface ModeCard {
  key: Mode;
  label: string;
  icon: ElementType;
  description: string;
}

const MODE_CARDS: ModeCard[] = [
  {
    key: 'clasico',
    label: 'Clásico',
    icon: Shield,
    description: 'Un impostor, todos conocen la categoría',
  },
  {
    key: 'caos',
    label: 'Caos',
    icon: Layers,
    description: 'Varios impostores posibles',
  },
  {
    key: 'ciego',
    label: 'Ciego',
    icon: EyeOff,
    description: 'Los jugadores no saben cuántos impostores hay',
  },
  {
    key: 'aliados',
    label: 'Aliados',
    icon: Users,
    description: 'El impostor tiene un cómplice',
  },
];

const ESPEJO_CARD: ModeCard = {
  key: 'espejo',
  label: 'Espejo',
  icon: Shuffle,
  description: 'El impostor también tiene una palabra',
};

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
  onBack,
  onNext,
}: StepModeProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Heading */}
      <h2 className="text-2xl font-bold text-stone-900">Modo de juego</h2>

      {/* Mode grid */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {MODE_CARDS.map(({ key, label, icon: Icon, description }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`rounded-lg border p-4 text-left cursor-pointer transition-colors ${
                mode === key
                  ? 'bg-amber-50 border-amber-600'
                  : 'bg-white border-stone-200 hover:bg-stone-50'
              }`}
            >
              <Icon size={24} className="mb-2 text-stone-700" />
              <p className="font-semibold text-stone-900">{label}</p>
              <p className="text-sm text-stone-500">{description}</p>
            </button>
          ))}
        </div>

        {/* Espejo full-width */}
        <button
          type="button"
          onClick={() => setMode(ESPEJO_CARD.key)}
          className={`w-full rounded-lg border p-4 text-left cursor-pointer transition-colors ${
            mode === ESPEJO_CARD.key
              ? 'bg-amber-50 border-amber-600'
              : 'bg-white border-stone-200 hover:bg-stone-50'
          }`}
        >
          <ESPEJO_CARD.icon size={24} className="mb-2 text-stone-700" />
          <p className="font-semibold text-stone-900">{ESPEJO_CARD.label}</p>
          <p className="text-sm text-stone-500">{ESPEJO_CARD.description}</p>
        </button>
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
