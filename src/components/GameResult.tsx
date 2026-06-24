import type { StartGameResponse } from '../types';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface GameResultProps {
  result: StartGameResponse;
  onPlayAgain: () => void;
}

const MODE_LABELS: Record<string, string> = {
  clasico: 'Clásico',
  caos: 'Caos',
  ciego: 'Ciego',
  aliados: 'Aliados',
  espejo: 'Espejo',
};

export function GameResult({ result, onPlayAgain }: GameResultProps) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto w-full">
      <div className="bg-[#1A1A1F] rounded-2xl border border-[#2A2A35] p-6 flex flex-col gap-4 text-center">
        <p className="text-gray-400 text-sm font-semibold uppercase tracking-widest">Categoría</p>
        <h2 className="text-3xl font-extrabold text-violet-400 uppercase tracking-wide">
          {result.category}
        </h2>
        <p className="text-gray-300 text-sm">
          Modo: <span className="text-white font-semibold">{MODE_LABELS[result.mode] ?? result.mode}</span>
          {' — '}
          <span className="text-violet-300 font-semibold">{result.n_impostors} impostor{result.n_impostors !== 1 ? 'es' : ''}</span>{' '}
          en juego
        </p>
      </div>

      {result.sent.length > 0 && (
        <div className="bg-[#1A1A1F] rounded-xl border border-[#2A2A35] p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Mensajes enviados</p>
          <div className="flex flex-col gap-2">
            {result.sent.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-green-400 text-base">✅</span>
                <span className="text-white text-sm">{name}</span>
                <Badge color="green">enviado</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.failed.length > 0 && (
        <div className="bg-[#1A1A1F] rounded-xl border border-red-500/20 p-4 flex flex-col gap-3">
          <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Fallidos</p>
          <div className="flex flex-col gap-2">
            {result.failed.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-red-400 text-base">❌</span>
                <span className="text-white text-sm">{name}</span>
                <Badge color="red">no inició el bot</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="default" size="lg" onClick={onPlayAgain} className="w-full">
        Otra ronda 🎲
      </Button>
    </div>
  );
}
