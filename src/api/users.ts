import type { Player } from "../types"
import { authFetch } from "./auth"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface PlayerCreate {
  name: string
  telegram_id: number
}

export async function listPlayers(token: string): Promise<Player[]> {
  const res = await authFetch(token, `${API_URL}/users/players`)
  if (!res.ok) throw new Error("Failed to load players")
  return res.json()
}

export async function createPlayer(token: string, data: PlayerCreate): Promise<Player> {
  const res = await authFetch(token, `${API_URL}/users/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create player")
  return res.json()
}

export async function deletePlayer(token: string, playerId: string): Promise<void> {
  const res = await authFetch(token, `${API_URL}/users/players/${playerId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete player")
}
