import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePlayers } from '@/hooks/usePlayers';
import { useGame } from '@/hooks/useGame';
import { StepPlayers } from './StepPlayers';
import type { Mode, Difficulty, StartGameResponse } from '@/types';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Jugadores',
  2: 'Modo',
  3: 'Revisar',
};

export function WizardShell() {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>('caos');
  const [difficulty, setDifficulty] = useState<Difficulty>('dificil');
  const [gameResult, setGameResult] = useState<StartGameResponse | null>(null);

  const { players, addPlayer, removePlayer } = usePlayers();
  const { state, result, start } = useGame();

  const isLoading = state === 'loading';

  // Sync game result from hook state into local state
  useEffect(() => {
    if (result) {
      setGameResult(result);
    }
  }, [result]);

  const handleAddPlayer = (name: string, telegramId?: number) => {
    addPlayer(name, telegramId ?? 0);
  };

  const onStart = async () => {
    const authToken = localStorage.getItem('auth_token') ?? '';
    await start(
      {
        players,
        mode,
        difficulty,
        categories: [],
      },
      authToken,
    );
  };

  if (gameResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 text-center text-stone-900">
          Game in progress
        </div>
      </div>
    );
  }

  const stepKeys: Step[] = [1, 2, 3];

  return (
    <div className="flex min-h-screen flex-col items-center bg-stone-50 p-4">
      <div className="w-full max-w-md">
        {/* Step indicator bar */}
        <nav className="mb-6 flex items-center justify-center gap-1">
          {stepKeys.map((s, index) => {
            const isActive = step === s;
            const isCompleted = step > s;
            const labelClass = isActive
              ? 'text-amber-600 font-semibold text-sm'
              : isCompleted
              ? 'text-stone-400 text-sm'
              : 'text-stone-300 text-sm';

            return (
              <div key={s} className="flex items-center gap-1">
                <span className={labelClass}>{STEP_LABELS[s]}</span>
                {index < stepKeys.length - 1 && (
                  <ChevronRight className="size-4 text-stone-300" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Step content */}
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          {step === 1 && (
            <StepPlayers
              players={players}
              addPlayer={handleAddPlayer}
              removePlayer={removePlayer}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <div className="text-stone-600">
              {/* StepMode placeholder — implemented in FE Task 5 */}
              <p className="text-sm">Modo: {mode}</p>
              <p className="text-sm">Dificultad: {difficulty}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="text-stone-600">
              {/* StepReview placeholder — implemented in FE Task 5 */}
              <p className="text-sm">Jugadores: {players.length}</p>
              <p className="text-sm">Modo: {mode}</p>
              <p className="text-sm">Dificultad: {difficulty}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  disabled={isLoading}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {isLoading ? 'Iniciando...' : 'Iniciar juego'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
