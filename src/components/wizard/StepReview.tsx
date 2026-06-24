import { Shield, Layers, EyeOff, Users, Shuffle, Target, UserX, Loader2, type LucideIcon } from 'lucide-react';
import type { Mode, Difficulty, Player } from '@/types';

const MODE_LABELS: Record<Mode, string> = {
  clasico: 'Clásico',
  caos: 'Caos',
  ciego: 'Ciego',
  aliados: 'Aliados',
  espejo: 'Espejo',
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil',
  dificil: 'Difícil',
  brutal: 'Brutal',
};

const MODE_ICONS: Record<Mode, LucideIcon> = {
  clasico: Shield,
  caos: Layers,
  ciego: EyeOff,
  aliados: Users,
  espejo: Shuffle,
};

function computeImpostors(playerCount: number, mode: Mode): string {
  if (mode === 'aliados') return '2 (cómplices)';
  if (playerCount <= 4) return '1';
  if (playerCount <= 7) return '1–2';
  return '2–3';
}

interface StepReviewProps {
  players: Player[];
  mode: Mode;
  difficulty: Difficulty;
  isLoading: boolean;
  onBack: () => void;
  onStart: () => Promise<void>;
}

export function StepReview({
  players,
  mode,
  difficulty,
  isLoading,
  onBack,
  onStart,
}: StepReviewProps) {
  const impostorCount = computeImpostors(players.length, mode);
  const ModeIcon = MODE_ICONS[mode];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold text-stone-900">¿Listos para jugar?</h2>

      {/* Summary card */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        {/* Players row */}
        <div className="flex items-center gap-3 py-2">
          <Users className="size-4 text-stone-400 shrink-0" />
          <span className="text-sm text-stone-500 flex-1">Jugadores</span>
          <span className="text-sm font-semibold text-stone-900">
            {players.length} jugador{players.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="border-t border-stone-100" />

        {/* Mode row */}
        <div className="flex items-center gap-3 py-2">
          <ModeIcon size={16} className="text-stone-500 shrink-0" />
          <span className="text-sm text-stone-500 flex-1">Modo</span>
          <span className="text-sm font-semibold text-stone-900">{MODE_LABELS[mode]}</span>
        </div>

        <div className="border-t border-stone-100" />

        {/* Difficulty row */}
        <div className="flex items-center gap-3 py-2">
          <Target className="size-4 text-stone-400 shrink-0" />
          <span className="text-sm text-stone-500 flex-1">Dificultad</span>
          <span className="text-sm font-semibold text-stone-900">{DIFFICULTY_LABELS[difficulty]}</span>
        </div>

        <div className="border-t border-stone-100" />

        {/* Impostors row */}
        <div className="flex items-center gap-3 py-2">
          <UserX className="size-4 text-stone-400 shrink-0" />
          <span className="text-sm text-stone-500 flex-1">Impostores</span>
          <span className="text-sm font-semibold text-stone-900">{impostorCount}</span>
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-stone-500">
        Los jugadores podrán ver su rol desde su link permanente. Telegram si está configurado.
      </p>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-lg border border-stone-200 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
      >
        ← Atrás
      </button>

      {/* Start button */}
      <button
        type="button"
        onClick={onStart}
        disabled={isLoading}
        className="w-full rounded-lg bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Iniciando...
          </>
        ) : (
          'JUGAR'
        )}
      </button>
    </div>
  );
}
