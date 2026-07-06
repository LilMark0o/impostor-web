import { useState } from 'react';
import type { StartGameResponse, Difficulty } from '@/types';
import { QrCard } from './QrCard';
import { SingleDeviceFlow } from './SingleDeviceFlow';
import { MODE_LABELS, DIFFICULTY_LABELS } from '@/constants/labels';

const ORIGIN = window.location.origin;

interface GameInProgressProps {
  result: StartGameResponse;
  difficulty: Difficulty;
  onNewRound: () => void;
}

export function GameInProgress({ result, difficulty, onNewRound }: GameInProgressProps) {
  const [singleDevice, setSingleDevice] = useState(false);

  const shareAllLinks = async () => {
    const lines = result.players
      .filter((p) => p.token)
      .map((p) => `${p.name}: ${ORIGIN}/p/${p.token}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(lines);
    } catch {
      // clipboard unavailable (non-HTTPS, denied permission) — fail silently
    }
  };

  const hasFailed = result.failed.length > 0;
  const modeLabel = MODE_LABELS[result.mode] ?? result.mode;
  const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

  if (singleDevice) {
    return (
      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={() => setSingleDevice(false)}
          className="self-start text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          ← Volver a los links
        </button>
        <SingleDeviceFlow result={result} onDone={() => setSingleDevice(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-stone-900">Partida en curso</h2>
        <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-1 rounded-full">
          EN VIVO
        </span>
      </div>

      {/* Metadata */}
      <p className="text-sm text-stone-500">
        Modo {modeLabel} · {difficultyLabel} · Categoría: {result.category}
      </p>

      {/* QR grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {result.players.map((player) => (
          <QrCard
            key={player.token || player.name}
            name={player.name}
            token={player.token}
            origin={ORIGIN}
          />
        ))}
      </div>

      {/* Failed Telegram note */}
      {hasFailed && (
        <p className="text-xs text-stone-400">
          Algunos jugadores no tienen Telegram configurado. Usa su QR o link.
        </p>
      )}

      {/* Actions */}
      <button
        type="button"
        onClick={onNewRound}
        className="w-full rounded-lg bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 transition-colors"
      >
        OTRA RONDA
      </button>

      <button
        type="button"
        onClick={() => setSingleDevice(true)}
        className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
      >
        Ver en un solo dispositivo
      </button>

      <button
        type="button"
        onClick={shareAllLinks}
        className="w-full rounded-lg border border-stone-200 py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
      >
        Compartir todos los links
      </button>
    </div>
  );
}
