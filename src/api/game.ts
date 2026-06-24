import { StartGameResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface StartGameRequest {
  players: { id: string; name: string; telegram_id: number | null; token: string }[];
  mode: string;
  difficulty: string;
  categories?: string[];
}

export async function startGame(
  req: StartGameRequest,
  token: string,
): Promise<StartGameResponse> {
  const res = await fetch(`${API_URL}/api/game/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Game start failed: ${res.status}`);
  return res.json();
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  const data = await res.json();
  return data.categories;
}
