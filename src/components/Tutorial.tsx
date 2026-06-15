interface TutorialProps {
  open: boolean;
  onToggle: () => void;
}

const STEPS = [
  { emoji: '🤖', text: 'Busca el bot en Telegram: @ImpostorGameBot (o el nombre que tenga)' },
  { emoji: '💬', text: 'Envíale /start al bot para activarlo' },
  { emoji: '🆔', text: 'Obtén tu ID: habla con @userinfobot y copia el número' },
  { emoji: '⚙️', text: 'Agrégalo en "Jugadores" con tu nombre y tu ID' },
  { emoji: '🎮', text: 'Cuando estén todos listos, el organizador presiona "Jugar"' },
];

export function Tutorial({ open, onToggle }: TutorialProps) {
  return (
    <div className="bg-[#1A1A1F] rounded-xl border border-[#2A2A35] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-gray-300 font-semibold text-sm">¿Cómo funciona?</span>
        <span
          className={[
            'text-gray-400 transition-transform duration-200 text-lg',
            open ? 'rotate-180' : '',
          ].join(' ')}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#2A2A35] pt-3">
          {STEPS.map((step) => (
            <div key={step.emoji} className="flex items-start gap-3">
              <span className="text-lg mt-0.5 shrink-0">{step.emoji}</span>
              <p className="text-gray-400 text-sm leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
