import { useState, useEffect } from "react"
import type { Player } from "../types"
import { useAuth } from "../contexts/AuthContext"
import { listPlayers, createPlayer, deletePlayer } from "../api/users"

const LS_KEY = "impostor_players"

function loadFromStorage(): Player[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function usePlayers() {
  const { user, token } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    if (user && token) {
      listPlayers(token)
        .then(setPlayers)
        .catch(() => setPlayers([]))
    } else {
      setPlayers(loadFromStorage())
    }
  }, [user, token])

  useEffect(() => {
    if (!user || !token) return
    const local = loadFromStorage()
    if (local.length === 0) return

    const remoteIds = players.map((p) => p.telegram_id)
    const toMerge = local.filter((p) => !remoteIds.includes(p.telegram_id))
    Promise.all(toMerge.map((p) => createPlayer(token, { name: p.name, telegram_id: p.telegram_id })))
      .then((created) => setPlayers((prev) => [...prev, ...created]))
      .catch(() => {})
    localStorage.removeItem(LS_KEY)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const addPlayer = async (name: string, telegram_id: number) => {
    if (user && token) {
      const player = await createPlayer(token, { name, telegram_id })
      setPlayers((prev) => [...prev, player])
    } else {
      const player: Player = { id: crypto.randomUUID(), name, telegram_id }
      const updated = [...players, player]
      setPlayers(updated)
      localStorage.setItem(LS_KEY, JSON.stringify(updated))
    }
  }

  const removePlayer = async (id: string) => {
    if (user && token) {
      await deletePlayer(token, id)
      setPlayers((prev) => prev.filter((p) => p.id !== id))
    } else {
      const updated = players.filter((p) => p.id !== id)
      setPlayers(updated)
      localStorage.setItem(LS_KEY, JSON.stringify(updated))
    }
  }

  return { players, addPlayer, removePlayer }
}
