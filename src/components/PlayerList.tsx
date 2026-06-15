import { useState } from 'react';
import type { Player } from '../types';
import { Button } from './ui/Button';

interface PlayerListProps {
  players: Player[];
  onAdd: (name: string, telegram_id: number) => void;
  onRemove: (id: string) => void;
}

export function PlayerList({ players, onAdd, onRemove }: PlayerListProps) {
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');

  function handleAdd() {
    const tid = parseInt(telegramId, 10);
    if (!name.trim() || isNaN(tid)) return;
    onAdd(name.trim(), tid);
    setName('');
    setTelegramId('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
  }

  const inputClass =
    'bg-[#0D0D0F] border border-[#2A2A35] rounded-lg text-white px-3 py-2 text-sm outline-none focus:border-violet-500 transition-colors placeholder-gray-600';

  return (
    <div className="flex flex-col gap-4">
      {players.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No hay jugadores aún. ¡Agrega el primero!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between bg-[#0D0D0F] border border-[#2A2A35] rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-white text-sm font-semibold">{p.name}</span>
                <span className="text-gray-500 text-xs ml-2">ID: {p.telegram_id}</span>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="text-red-400 hover:text-red-300 transition-colors text-lg leading-none ml-2"
                aria-label="Eliminar jugador"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-[#2A2A35]">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Agregar jugador</p>
        <input
          className={inputClass}
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className={inputClass}
          placeholder="Telegram ID (número)"
          type="number"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          disabled={!name.trim() || !telegramId.trim()}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
}
