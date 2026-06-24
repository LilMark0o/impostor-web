import { useState, useRef } from 'react';
import { Info, PhoneOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Player } from '@/types';

interface StepPlayersProps {
  players: Player[];
  addPlayer: (name: string, telegramId?: number) => void;
  removePlayer: (id: string) => void;
  onNext: () => void;
}

export function StepPlayers({ players, addPlayer, removePlayer, onNext }: StepPlayersProps) {
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const tid = telegramId.trim() ? parseInt(telegramId.trim(), 10) : undefined;
    addPlayer(trimmedName, tid);
    setName('');
    setTelegramId('');
    nameInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const canProceed = players.length >= 3;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold text-stone-900">Jugadores</h1>

      <div className="flex items-start gap-2 text-sm text-stone-500">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Cada jugador escanea su QR una vez y lo guarda. El link es permanente.
        </span>
      </div>

      {/* Player list */}
      {players.length > 0 && (
        <ul className="flex flex-col gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-stone-900">{player.name}</span>
                {player.telegram_id == null && (
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <PhoneOff className="size-3" />
                    Sin Telegram
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePlayer(player.id)}
                className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                aria-label={`Eliminar ${player.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add player form */}
      <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-3">
        <Input
          ref={nameInputRef}
          type="text"
          placeholder="Nombre del jugador"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Input
          type="number"
          placeholder="Telegram ID (opcional)"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-sm text-stone-600"
        />
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim()}
          className="bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Agregar
        </Button>
      </div>

      {/* Next button */}
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
        >
          Siguiente →
        </Button>
        {!canProceed && (
          <p className="text-center text-xs text-stone-400">(mínimo 3)</p>
        )}
      </div>
    </div>
  );
}
