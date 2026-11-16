import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { getRevealState } from '@/api/reveal'
import type { RevealState } from '@/types'

interface CardModalProps {
  playerName: string
  token: string
  onClose: () => void
}

export function CardModal({ playerName, token, onClose }: CardModalProps) {
  const [data, setData] = useState<RevealState | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    setFlipped(false)
    setError(null)
    getRevealState(token)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const isImpostor = data?.is_impostor === true
  const word = data?.category

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center select-none">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 p-2 text-stone-500 hover:text-white transition-colors"
        aria-label="Cerrar"
      >
        <X size={24} />
      </button>

      <p className="text-stone-400 text-sm mb-8 tracking-wide">{playerName}</p>

      {loading && (
        <div className="w-64 h-96 bg-stone-800 rounded-2xl animate-pulse" />
      )}

      {error && (
        <p className="text-red-400 text-sm">No se pudo cargar la carta</p>
      )}

      {!loading && !error && data && (
        <>
          {/* 3D flip card */}
          <button
            type="button"
            style={{ perspective: '1000px' }}
            className="w-64 h-96 cursor-pointer"
            onClick={() => !flipped && setFlipped(true)}
            tabIndex={-1}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Back — face down */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                className="absolute inset-0 bg-stone-800 border-2 border-stone-600 rounded-2xl flex flex-col items-center justify-center gap-4"
              >
                <div className="w-24 h-24 rounded-full border-4 border-amber-600 flex items-center justify-center">
                  <div className="w-14 h-14 border-4 border-amber-600 rotate-45 rounded-sm" />
                </div>
                <p className="text-stone-500 text-sm">Toca para revelar</p>
              </div>

              {/* Front — face up */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
                className={`absolute inset-0 rounded-2xl border-2 flex flex-col items-center justify-center gap-4 px-6 ${
                  isImpostor
                    ? 'bg-stone-900 border-red-500'
                    : 'bg-stone-50 border-green-500'
                }`}
              >
                {isImpostor ? (
                  <>
                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest">Tu rol</p>
                    <p className="text-white text-5xl font-black">Impostor</p>
                    {data.hint ? (
                      <>
                        <div className="w-full border-t border-stone-700 pt-3 flex flex-col items-center gap-1">
                          <p className="text-stone-500 text-xs uppercase tracking-widest">Tu pista</p>
                          <p className="text-amber-300 text-sm text-center leading-relaxed">
                            {data.hint}
                          </p>
                        </div>
                        <p className="text-stone-500 text-xs text-center">
                          No sabes la categoría. Disimula.
                        </p>
                      </>
                    ) : (
                      <p className="text-stone-400 text-sm text-center leading-relaxed mt-2">
                        Los demás hablan de una categoría. Tú no sabes cuál. Disimula.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-green-600 text-xs font-bold uppercase tracking-widest">Tu rol</p>
                    <p className="text-stone-800 text-3xl font-black">Amigo</p>
                    <div className="w-full border-t border-stone-200 pt-4 flex flex-col items-center gap-1">
                      <p className="text-stone-400 text-xs uppercase tracking-widest">Tu palabra</p>
                      <p className="text-stone-900 text-4xl font-black text-center tracking-wide">
                        {word?.toUpperCase() ?? '—'}
                      </p>
                    </div>
                    <p className="text-stone-300 text-xs text-center">
                      No muestres esto a otros jugadores
                    </p>
                  </>
                )}
              </div>
            </div>
          </button>

          {/* Action button below card */}
          <div className="mt-8">
            {!flipped ? (
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="px-10 py-3 bg-amber-600 text-white font-semibold rounded-full hover:bg-amber-700 transition-colors"
              >
                Voltear carta
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-10 py-3 bg-stone-700 text-white font-semibold rounded-full hover:bg-stone-600 transition-colors"
              >
                Listo, cerrar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
