import type { Difficulty } from '../types';

const DIFFS = [
  { key: 'facil',   emoji: '😊', label: 'Fácil' },
  { key: 'dificil', emoji: '🧠', label: 'Difícil' },
  { key: 'brutal',  emoji: '💀', label: 'Brutal' },
] as const;

interface DifficultyToggleProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}

export function DifficultyToggle({ value, onChange }: DifficultyToggleProps) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-[#2A2A35] bg-[#1A1A1F] p-1 gap-1">
      {DIFFS.map((d) => {
        const isSelected = value === d.key;
        return (
          <button
            key={d.key}
            onClick={() => onChange(d.key as Difficulty)}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200',
              isSelected
                ? 'bg-violet-600 text-white'
                : 'bg-transparent text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            <span>{d.emoji}</span>
            <span>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}
