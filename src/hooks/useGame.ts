import { useState } from 'react';
import { startGame } from '../api/game';
import type { StartGameRequest } from '../api/game';
import type { GameResult } from '../types';

type GameState = 'idle' | 'loading' | 'result' | 'error';

export function useGame() {
  const [state, setState] = useState<GameState>('idle');
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(req: StartGameRequest) {
    setState('loading');
    setError(null);
    try {
      const res = await startGame(req);
      setResult(res);
      setState('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setState('error');
    }
  }

  function reset() {
    setState('idle');
    setResult(null);
    setError(null);
  }

  return { state, result, error, start, reset };
}
