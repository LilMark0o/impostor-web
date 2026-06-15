import type { Player } from '../types';
import { PlayerList } from './PlayerList';

interface ConfigDrawerProps {
  open: boolean;
  onClose: () => void;
  players: Player[];
  onAdd: (name: string, telegram_id: number) => void;
  onRemove: (id: string) => void;
}

export function ConfigDrawer({ open, onClose, players, onAdd, onRemove }: ConfigDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* Drawer — slides from right on desktop, from bottom on mobile */}
      <div
        className={[
          'fixed z-50 bg-[#1A1A1F] border-[#2A2A35] transition-transform duration-300 ease-in-out',
          // Mobile: bottom drawer
          'bottom-0 left-0 right-0 rounded-t-2xl border-t max-h-[85vh] overflow-y-auto',
          // Desktop: right drawer
          'sm:bottom-auto sm:top-0 sm:left-auto sm:right-0 sm:h-full sm:w-96 sm:rounded-none sm:rounded-l-2xl sm:border-t-0 sm:border-l',
          open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between p-5 border-b border-[#2A2A35]">
          <h2 className="text-white font-bold text-lg">Jugadores ⚙️</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          <PlayerList players={players} onAdd={onAdd} onRemove={onRemove} />
        </div>
      </div>
    </>
  );
}
