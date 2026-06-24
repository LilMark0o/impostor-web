import { useState, useEffect } from 'react'
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
  const handleReveal = () => {
    if (data?.session_id) {
      localStorage.setItem(`reveal_${data.session_id}`, 'true')
    }
    setRevealed(true)
  }

  // State 1: Loading / Waiting
  if (isLoading || data?.state === 'waiting') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <>
            <div className="bg-amber-500 rounded-full animate-pulse w-3 h-3" />
            <h1 className="text-stone-900 text-2xl font-semibold">Esperando partida</h1>
            <p className="text-stone-500">Hola, {data?.player_name ?? 'jugador'}</p>
            <p className="text-stone-400 text-sm">Esta pantalla se actualiza sola</p>
          </>
        )}
      </div>
    )
  }

  // State 2: Ready — tap to reveal
  if (data?.state === 'ready' && !revealed) {
    return (
      <div
        className="min-h-screen bg-stone-900 text-white flex flex-col items-center justify-center gap-4 cursor-pointer select-none"
        onClick={handleReveal}
      >
        <Hand size={48} className="text-amber-400" />
        <h1 className="text-white text-2xl font-semibold">Toca para ver tu rol</h1>
        <p className="text-stone-400">Hola, {data.player_name}</p>
      </div>
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
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center gap-3">
      <CheckCircle2 size={56} className="text-green-500" />
      <h1 className="text-stone-900 text-2xl font-semibold">No eres el Impostor</h1>
      <p className="text-stone-900 text-4xl font-bold mt-2">{data?.category}</p>
      <p className="text-stone-400 text-sm">No muestres esta pantalla a otros jugadores</p>
    </div>
  )
}
