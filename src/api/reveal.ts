import { RevealState } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function getRevealState(playerToken: string): Promise<RevealState> {
  const res = await fetch(`${API_URL}/p/${playerToken}`);
  if (!res.ok) throw new Error(`Reveal fetch failed: ${res.status}`);
  return res.json();
}
