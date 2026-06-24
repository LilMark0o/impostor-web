import { useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePlayers } from '@/hooks/usePlayers';
import { useGame } from '@/hooks/useGame';
import { StepPlayers } from './StepPlayers';
import { StepReview } from './StepReview';
import { GameInProgress } from '@/components/GameInProgress';
import type { Mode, Difficulty } from '@/types';

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'Jugadores',
  2: 'Modo',
  3: 'Revisar',
};

const stepKeys: Step[] = [1, 2, 3];

export function WizardShell() {
  const [step, setStep] = useState<Step>(1);
  const [mode, _setMode] = useState<Mode>('caos');
  const [difficulty, _setDifficulty] = useState<Difficulty>('dificil');

  const { players, addPlayer, removePlayer } = usePlayers();
  const { state, result, start } = useGame();

  const isLoading = state === 'loading';

  const handleAddPlayer = useCallback(
    (name: string, telegramId?: number) => {
      addPlayer(name, telegramId ?? 0);
    },
    [addPlayer],
  );

  const onStart = useCallback(async () => {
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
  }, [players, mode, difficulty, start]);

  const goToStep1 = useCallback(() => setStep(1), []);
  const goToStep2 = useCallback(() => setStep(2), []);
  const goToStep3 = useCallback(() => setStep(3), []);

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-2xl">
          <GameInProgress
            result={result}
            difficulty={difficulty}
            onNewRound={goToStep1}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-stone-50 p-4">
      <div className="w-full max-w-md">
        {/* Step indicator bar */}
        <nav aria-label="Pasos del asistente" className="mb-6 flex items-center justify-center gap-1">
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
              onNext={goToStep2}
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
                  onClick={goToStep1}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={goToStep3}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
          {step === 3 && (
            <StepReview
              players={players}
              mode={mode}
              difficulty={difficulty}
              isLoading={isLoading}
              onBack={goToStep2}
              onStart={onStart}
            />
          )}
        </div>
      </div>
    </div>
  );
}
