import type { Mode } from '../types';

const MODES = [
  { key: 'clasico', emoji: '🎭', label: 'Clásico', desc: 'Siempre 1 impostor' },
  { key: 'caos',    emoji: '🌀', label: 'Caos',    desc: 'Impostores al azar' },
  { key: 'ciego',   emoji: '👁️', label: 'Ciego',   desc: 'Sin saber cuántos' },
  { key: 'aliados', emoji: '🤝', label: 'Aliados', desc: '2 impostores aliados' },
  { key: 'espejo',  emoji: '🪞', label: 'Espejo',  desc: 'Impostor, otra palabra' },
] as const;

interface ModeCardProps {
  selected: Mode;
  onSelect: (mode: Mode) => void;
}

export function ModeCard({ selected, onSelect }: ModeCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MODES.map((m) => {
        const isSelected = selected === m.key;
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key as Mode)}
            className={[
              'flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left',
              isSelected
                ? 'border-violet-500 bg-violet-600/10'
                : 'border-[#2A2A35] bg-[#1A1A1F] hover:border-violet-500/50',
            ].join(' ')}
          >
            <span className="text-2xl mb-1">{m.emoji}</span>
            <span className={['font-bold text-sm', isSelected ? 'text-violet-300' : 'text-white'].join(' ')}>
              {m.label}
            </span>
            <span className="text-xs text-gray-500 mt-0.5">{m.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
