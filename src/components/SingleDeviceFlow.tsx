import { useState } from 'react'
import { Check } from 'lucide-react'
import { MODE_LABELS } from '@/constants/labels'
import type { StartGameResponse } from '@/types'
import { CardModal } from './CardModal'

interface SingleDeviceFlowProps {
  result: StartGameResponse
  onDone: () => void
}

export function SingleDeviceFlow({ result, onDone }: SingleDeviceFlowProps) {
  const [seenPlayers, setSeenPlayers] = useState<Set<string>>(new Set())
  const [openPlayer, setOpenPlayer] = useState<{ name: string; token: string } | null>(null)

  const allSeen = seenPlayers.size === result.players.length

  const handleClose = (playerName: string) => {
    setSeenPlayers((prev) => new Set([...prev, playerName]))
    setOpenPlayer(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-1">
          {MODE_LABELS[result.mode] ?? result.mode} · {result.category}
        </p>
        <h2 className="text-2xl font-bold text-stone-900">Pasen el teléfono</h2>
        <p className="text-sm text-stone-500 mt-1">
          Cada jugador toca su nombre y ve su carta en privado.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {result.players.map((player) => {
          const seen = seenPlayers.has(player.name)
          return (
            <button
              key={player.token || player.name}
              type="button"
              onClick={() => setOpenPlayer({ name: player.name, token: player.token })}
              className={`flex items-center justify-between px-4 py-4 rounded-xl border transition-colors text-left ${
                seen
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-stone-200 hover:bg-stone-50'
              }`}
            >
              <span className={`font-semibold ${seen ? 'text-stone-600' : 'text-stone-900'}`}>
                {player.name}
              </span>
              {seen ? (
                <Check size={18} className="text-green-500 shrink-0" />
              ) : (
                <span className="text-xs text-stone-400">Toca para ver</span>
              )}
            </button>
          )
        })}
      </div>

      {allSeen && (
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          ¡Todos listos — a jugar!
        </button>
      )}

      {openPlayer && (
        <CardModal
          playerName={openPlayer.name}
          token={openPlayer.token}
          onClose={() => handleClose(openPlayer.name)}
        />
      )}
    </div>
  )
}
