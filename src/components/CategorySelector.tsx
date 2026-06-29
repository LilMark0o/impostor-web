import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { getCategories } from '@/api/game'
import { cn } from '@/lib/utils'

interface CategorySelectorProps {
  value: string[]
  onChange: (cats: string[]) => void
  className?: string
}

export function CategorySelector({ value, onChange, className }: CategorySelectorProps) {
  const [sysCats, setSysCats] = useState<string[]>([])
  const [selectedSys, setSelectedSys] = useState<string[]>([])
  const [customCats, setCustomCats] = useState<string[]>([])
  const [customInput, setCustomInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    getCategories()
      .then((cats) => {
        setSysCats(cats)
        if (!initialized.current) {
          initialized.current = true
          if (value.length === 0) {
            setSelectedSys(cats)
            setCustomCats([])
          } else {
            const sys = value.filter((c) => cats.includes(c))
            const custom = value.filter((c) => !cats.includes(c))
            setSelectedSys(sys.length > 0 ? sys : cats)
            setCustomCats(custom)
          }
        }
      })
      .catch(() => {
        // API unavailable — component shows empty chip grid, custom input still works
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function notify(sys: string[], custom: string[], allSys: string[]) {
    if (sys.length === allSys.length && custom.length === 0) {
      onChange([])
    } else {
      onChange([...sys, ...custom])
    }
  }

  function toggleSys(cat: string) {
    const next = selectedSys.includes(cat)
      ? selectedSys.filter((c) => c !== cat)
      : [...selectedSys, cat]
    setSelectedSys(next)
    notify(next, customCats, sysCats)
  }

  function addCustom() {
    const trimmed = customInput.trim()
    if (!trimmed || customCats.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) return
    const next = [...customCats, trimmed]
    setCustomCats(next)
    setCustomInput('')
    notify(selectedSys, next, sysCats)
  }

  function removeCustom(cat: string) {
    const next = customCats.filter((c) => c !== cat)
    setCustomCats(next)
    notify(selectedSys, next, sysCats)
  }

  const allSelected = selectedSys.length === sysCats.length && customCats.length === 0
  const label = allSelected
    ? 'todas'
    : `${selectedSys.length} de ${sysCats.length}${customCats.length > 0 ? ` + ${customCats.length} custom` : ''}`

  return (
    <div className={cn('rounded-lg border border-stone-200', className)}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Cerrar categorías' : 'Abrir categorías'}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Categorías
          </span>
          <span className="text-sm text-stone-400">{label}</span>
        </div>
        {expanded ? (
          <ChevronDown size={16} className="text-stone-400" />
        ) : (
          <ChevronRight size={16} className="text-stone-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-stone-100">
          {/* System category chips */}
          <div className="flex flex-wrap gap-2 pt-3">
            {sysCats.map((cat) => {
              const selected = selectedSys.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleSys(cat)}
                  aria-pressed={selected}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm border transition-colors capitalize',
                    selected
                      ? 'bg-amber-50 border-amber-600 text-amber-800'
                      : 'bg-white border-stone-200 text-stone-400 hover:bg-stone-50',
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Custom category chips */}
          {customCats.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customCats.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-50 border border-green-500 text-green-800"
                >
                  {cat}
                  <button
                    type="button"
                    onClick={() => removeCustom(cat)}
                    className="text-green-600 hover:text-green-900"
                    aria-label={`Eliminar ${cat}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Custom input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              placeholder="Categoría custom (ej. reggaetón)"
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={addCustom}
              className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800 transition-colors"
            >
              + Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
