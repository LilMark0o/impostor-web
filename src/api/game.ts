import type { GameResult, Mode, Difficulty } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:8000';

export interface StartGameRequest {
  players: { name: string; telegram_id: number }[];
  mode: Mode;
  difficulty: Difficulty;
  categories?: string[];
}

export async function startGame(req: StartGameRequest): Promise<GameResult> {
  const res = await fetch(`${API_URL}/api/game/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Error ${res.status}`);
  }
  return res.json() as Promise<GameResult>;
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  const data = await res.json() as { categories: string[] };
  return data.categories;
}
