import { useState, useCallback } from 'react';
import { ChevronRight, LogIn, LogOut } from 'lucide-react';
import { usePlayers } from '@/hooks/usePlayers';
import { useGame } from '@/hooks/useGame';
import { useAuth } from '@/contexts/AuthContext';
import { StepPlayers } from './StepPlayers';
import { StepMode } from './StepMode';
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
  const [mode, setMode] = useState<Mode>('caos');
  const [difficulty, setDifficulty] = useState<Difficulty>('dificil');

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
    // Anonymous players have locally-generated UUIDs for UI purposes only;
    // clear id before sending so the engine skips DB result recording.
    const playersForApi = user
      ? players
      : players.map((p) => ({ ...p, id: '' }));
    await start({ players: playersForApi, mode, difficulty, categories: [] }, authToken);
  }, [players, mode, difficulty, start, user]);

  const goToStep1 = useCallback(() => setStep(1), []);
  const goToStep2 = useCallback(() => setStep(2), []);
  const goToStep3 = useCallback(() => setStep(3), []);

  const { user, login, logout } = useAuth();

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
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-stone-900 font-bold text-lg">El Impostor</span>
          {user ? (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
            >
              <LogOut size={14} />
              {user.name.split(' ')[0]}
            </button>
          ) : (
            <button
              type="button"
              onClick={login}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
              title="Conecta para guardar jugadores y activar QR permanentes"
            >
              <LogIn size={14} />
              Conectar
            </button>
          )}
        </div>

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
            <StepMode
              mode={mode}
              setMode={setMode}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              onBack={goToStep1}
              onNext={goToStep3}
            />
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
