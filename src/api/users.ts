import { Player } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function authFetch(token: string, input: string, init?: RequestInit) {
  return fetch(`${API_URL}${input}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}

export async function listPlayers(token: string): Promise<Player[]> {
  const res = await authFetch(token, '/users/players');
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function createPlayer(
  token: string,
  data: { name: string; telegram_id?: number | null },
): Promise<Player> {
  const res = await authFetch(token, '/users/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create player');
  return res.json();
}

export async function deletePlayer(token: string, playerId: string): Promise<void> {
  await authFetch(token, `/users/players/${playerId}`, { method: 'DELETE' });
}
