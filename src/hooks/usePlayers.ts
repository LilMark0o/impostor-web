import { useState, useEffect } from 'react';
import type { Player } from '../types';

const STORAGE_KEY = 'impostor_players';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Player[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players]);

  function addPlayer(name: string, telegram_id: number) {
    setPlayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, telegram_id },
    ]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  return { players, addPlayer, removePlayer };
}
