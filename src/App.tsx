import { useState } from 'react';
import type { Mode, Difficulty } from './types';
import { usePlayers } from './hooks/usePlayers';
import { useGame } from './hooks/useGame';
import { ModeCard } from './components/ModeCard';
import { DifficultyToggle } from './components/DifficultyToggle';
import { ConfigDrawer } from './components/ConfigDrawer';
import { Tutorial } from './components/Tutorial';
import { GameResult } from './components/GameResult';
import { Button } from './components/ui/Button'
import AuthButton from './components/AuthButton';

export default function App() {
  const [mode, setMode] = useState<Mode>('caos');
  const [difficulty, setDifficulty] = useState<Difficulty>('dificil');
  const [configOpen, setConfigOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const { players, addPlayer, removePlayer } = usePlayers();
  const { state, result, error, start, reset } = useGame();

  function handleStart() {
    start({
      players: players.map((p) => ({ name: p.name, telegram_id: p.telegram_id })),
      mode,
      difficulty,
    });
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F]" style={{ fontFamily: 'Nunito, sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0D0D0F]/90 backdrop-blur border-b border-[#2A2A35] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-white font-extrabold text-xl leading-tight">🎭 El Impostor</h1>
            <p className="text-gray-500 text-xs">¿Quién está mintiendo?</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigOpen(true)}
              className="relative flex items-center gap-2 bg-[#1A1A1F] border border-[#2A2A35] rounded-xl px-3 py-2 text-gray-400 hover:text-white hover:border-violet-500/50 transition-all"
            >
              <span className="text-lg">⚙️</span>
              {players.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-violet-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {players.length}
                </span>
              )}
            </button>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      {state === 'result' && result ? (
        <GameResult result={result} onPlayAgain={reset} />
      ) : (
        <main className="max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-6">
          {/* Mode selection */}
          <section className="flex flex-col gap-3">
            <h2 className="text-gray-300 font-bold text-sm uppercase tracking-widest">
              Modo de juego
            </h2>
            <ModeCard selected={mode} onSelect={setMode} />
          </section>

          {/* Difficulty */}
          <section className="flex flex-col gap-3">
            <h2 className="text-gray-300 font-bold text-sm uppercase tracking-widest">
              Dificultad de la pista
            </h2>
            <DifficultyToggle value={difficulty} onChange={setDifficulty} />
          </section>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Player count warning */}
          {players.length < 2 && (
            <p className="text-gray-500 text-sm text-center">
              Agrega al menos 2 jugadores en ⚙️ para jugar
            </p>
          )}

          {/* Play button */}
          <Button
            variant="default"
            size="lg"
            disabled={players.length < 2 || state === 'loading'}
            onClick={handleStart}
            className="w-full"
          >
            {state === 'loading' ? '⏳ Enviando...' : '🎮 Jugar'}
          </Button>

          {/* Tutorial */}
          <Tutorial open={tutorialOpen} onToggle={() => setTutorialOpen((v) => !v)} />
        </main>
      )}

      {/* Config drawer */}
      <ConfigDrawer
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        players={players}
        onAdd={addPlayer}
        onRemove={removePlayer}
      />
    </div>
  );
}
