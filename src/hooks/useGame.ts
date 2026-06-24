import { useState } from 'react';
import { startGame } from '../api/game';
import type { StartGameRequest } from '../api/game';
import type { StartGameResponse } from '../types';

type GameState = 'idle' | 'loading' | 'result' | 'error';

export function useGame() {
  const [state, setState] = useState<GameState>('idle');
  const [result, setResult] = useState<StartGameResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(req: StartGameRequest, token: string) {
    setState('loading');
    setError(null);
    try {
      const res = await startGame(req, token);
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
