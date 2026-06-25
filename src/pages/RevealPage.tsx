import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Hand, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useReveal } from '../hooks/useReveal'

export default function RevealPage() {
  const { token } = useParams<{ token: string }>()
  const { data, error, isLoading } = useReveal(token ?? '')
  const [revealed, setRevealed] = useState(false)

  // Restore reveal state from localStorage when session_id is available
  useEffect(() => {
    if (data?.session_id) {
      const stored = localStorage.getItem(`reveal_${data.session_id}`)
      if (stored === 'true') {
        setRevealed(true)
      }
    }
  }, [data?.session_id])

  // Persist reveal state to localStorage
  const handleReveal = useCallback(() => {
    if (!data?.session_id) return
    localStorage.setItem(`reveal_${data.session_id}`, 'true')
    setRevealed(true)
  }, [data?.session_id])

  // Error: early return so errors after data is set are never swallowed
  if (error) {
    const isNotFound = error.includes('404')
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {isNotFound ? (
          <>
            <p className="text-stone-700 font-semibold">Reveal no disponible</p>
            <p className="text-stone-400 text-sm">
              Este enlace es de un juego anónimo. Inicia sesión para activar el reveal permanente.
            </p>
          </>
        ) : (
          <p className="text-red-500">{error}</p>
        )}
      </div>
    )
  }

  // State 1: Loading / Waiting
  if (isLoading || data?.state === 'waiting') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
        <div className="bg-amber-500 rounded-full animate-pulse w-3 h-3" />
        <h1 className="text-stone-900 text-2xl font-semibold">Esperando partida</h1>
        <p className="text-stone-500">Hola, {data?.player_name ?? 'jugador'}</p>
        <p className="text-stone-400 text-sm">Esta pantalla se actualiza sola</p>
      </div>
    )
  }

  // State 2: Ready — tap to reveal
  if (data?.state === 'ready' && !revealed) {
    return (
      <button
        type="button"
        className="w-full min-h-screen bg-stone-900 flex flex-col items-center justify-center gap-4 text-white select-none border-none outline-none"
        onClick={handleReveal}
      >
        <Hand size={48} className="text-amber-400" />
        <h1 className="text-white text-2xl font-semibold">Toca para ver tu rol</h1>
        <p className="text-stone-400">Hola, {data.player_name}</p>
      </button>
    )
  }

  // State 3b: Revealed — IS impostor
  if (data?.state === 'ready' && revealed && data.is_impostor === true) {
    return (
      <div className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center gap-4">
        <AlertTriangle size={56} className="text-amber-400" />
        <h1 className="text-white text-3xl font-bold">Eres el Impostor</h1>
        <p className="text-stone-300 text-center max-w-xs">
          Los demás hablan de una categoría. Tú no sabes cuál. Disimula.
        </p>
      </div>
    )
  }

  // State 3a: Revealed — NOT impostor
  if (!data) return null // should not happen, but guards the fall-through

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
      <CheckCircle2 size={56} className="text-green-500" />
      <h1 className="text-stone-900 text-2xl font-semibold">No eres el Impostor</h1>
      <p className="text-stone-900 text-4xl font-bold mt-2">{data.category}</p>
      <p className="text-stone-400 text-sm">No muestres esta pantalla a otros jugadores</p>
    </div>
  )
}
