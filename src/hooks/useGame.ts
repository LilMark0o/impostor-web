import { useState } from 'react';
import { startGame } from '../api/game';
import type { StartGameRequest } from '../api/game';
import type { StartGameResponse } from '../types';
import { saveTokens, saveCategories, addSessionWord, getSessionWords } from '../lib/playerTokens';

type GameState = 'idle' | 'loading' | 'result' | 'error';

export function useGame() {
  const [state, setState] = useState<GameState>('idle');
  const [result, setResult] = useState<StartGameResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(req: StartGameRequest, token: string) {
    setState('loading');
    setError(null);
    try {
      // Inject session words so the backend avoids repeating them
      const exclude_words = getSessionWords();
      const res = await startGame({ ...req, exclude_words }, token);
      saveTokens(res.players);
      saveCategories(req.categories ?? []);
      // Track the word used in this round
      if (res.word) addSessionWord(res.word);
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
