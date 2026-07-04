import { useState, useCallback, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { usePlayers } from '@/hooks/usePlayers';
import { useGame } from '@/hooks/useGame';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredTokens, clearStoredTokens, clearStoredCategories } from '@/lib/playerTokens';
import { StepPlayers } from './StepPlayers';
import { StepMode } from './StepMode';
import { StepReview } from './StepReview';
import { GameInProgress } from '@/components/GameInProgress';
import { RondaPanel } from '@/components/RondaPanel';
import type { RondaLaunchConfig } from '@/components/RondaPanel';
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
  const [categories, setCategories] = useState<string[]>([]);
  const [quickStartNames, setQuickStartNames] = useState<string[]>([]);
  const [showCategoryToImpostor, setShowCategoryToImpostor] = useState(true)
  const [showImpostorCount, setShowImpostorCount] = useState(true)

  const { players, addPlayer, removePlayer, clearPlayers } = usePlayers();

  useEffect(() => {
    const stored = getStoredTokens()
    if (stored.length > 0) {
      setQuickStartNames(stored.map((s) => s.name))
    }
  }, [])
  const { state, result, start, reset } = useGame();

  useEffect(() => {
    if (result?.mode && result.mode !== 'aleatorio') {
      setMode(result.mode as Mode)
    }
  }, [result])

  const isLoading = state === 'loading';
  const [showRondaPanel, setShowRondaPanel] = useState(false);

  const { user, token } = useAuth();

  const handleAddPlayer = useCallback(
    (name: string, telegramId?: number) => {
      addPlayer(name, telegramId ?? 0);
    },
    [addPlayer],
  );

  const onStart = useCallback(async () => {
    // Anonymous players have locally-generated UUIDs for UI purposes only;
    // clear id before sending so the engine skips DB result recording.
    const playersForApi = user
      ? players
      : players.map((p) => ({ ...p, id: '' }));
    await start({ players: playersForApi, mode, difficulty, categories, show_category_to_impostor: showCategoryToImpostor, show_impostor_count: showImpostorCount }, token ?? '');
  }, [players, mode, difficulty, categories, start, user, token]);

  const goToStep1 = useCallback(() => setStep(1), []);
  const goToStep2 = useCallback(() => setStep(2), []);
  const goToStep3 = useCallback(() => setStep(3), []);

  const handleNewRound = useCallback(() => setShowRondaPanel(true), []);

  const handleRondaLaunch = useCallback(
    async (cfg: RondaLaunchConfig) => {
      setShowRondaPanel(false);
      setMode(cfg.mode);
      setDifficulty(cfg.difficulty);
      setCategories(cfg.categories);
      setShowCategoryToImpostor(cfg.showCategoryToImpostor);
      setShowImpostorCount(cfg.showImpostorCount);
      reset();
      const playersForApi = cfg.players.map((p) => ({
        id: '',
        name: p.name,
        telegram_id: null as null,
        token: p.token,
      }));
      await start(
        {
          players: playersForApi,
          mode: cfg.mode,
          difficulty: cfg.difficulty,
          categories: cfg.categories,
          show_category_to_impostor: cfg.showCategoryToImpostor,
          show_impostor_count: cfg.showImpostorCount,
        },
        token ?? '',
      );
    },
    [reset, start, token],
  );

  if (result && showRondaPanel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-2xl">
          <RondaPanel
            players={result.players}
            currentMode={mode}
            currentDifficulty={difficulty}
            currentCategories={categories}
            isLoading={isLoading}
            onLaunch={handleRondaLaunch}
            onCancel={() => setShowRondaPanel(false)}
          />
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-2xl">
          <GameInProgress
            result={result}
            mode={mode}
            difficulty={difficulty}
            onNewRound={handleNewRound}
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
        </div>

        {/* Quick-start banner */}
        {quickStartNames.length > 0 && step === 1 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800 font-medium">
              Continuar con {quickStartNames.join(', ')}
            </p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setQuickStartNames([])
                  setStep(2)
                }}
                className="text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
              >
                → Continuar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearPlayers()
                  clearStoredTokens()
                  clearStoredCategories()
                  setQuickStartNames([])
                }}
                className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
              >
                Nuevo grupo
              </button>
            </div>
          </div>
        )}

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
              categories={categories}
              onCategoriesChange={setCategories}
              onBack={goToStep1}
              onNext={goToStep3}
              playerCount={players.length}
              showCategoryToImpostor={showCategoryToImpostor}
              onShowCategoryToImpostorChange={setShowCategoryToImpostor}
              showImpostorCount={showImpostorCount}
              onShowImpostorCountChange={setShowImpostorCount}
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
