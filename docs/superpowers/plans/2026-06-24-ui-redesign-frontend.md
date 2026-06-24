# El Impostor — UI Redesign: Frontend Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark purple single-page UI with a light-mode Stone/Amber wizard (3 steps: players → mode → review) plus a permanent QR reveal page at `/p/:token` — all using Lucide React icons, shadcn/ui components, and no emojis.

**Architecture:** React Router v6 adds two routes: `/` (wizard) and `/p/:token` (reveal page). WizardShell orchestrates 3 steps. After game start, GameInProgress shows a QR card per player. RevealPage polls `GET /p/{token}` every 3s and shows waiting → tap → role states. shadcn/ui provides base components; Tailwind stone+amber is the design system.

**Tech Stack:** React 18, React Router v6, shadcn/ui (Vite), Lucide React, qrcode.react, Tailwind CSS 3, TypeScript 5.6.

**Run all commands from:** `/Users/marco/Desktop/programming/github/impostor-web`

**Prerequisite:** Backend plan `2026-06-24-qr-reveal-backend.md` must be deployed first — the reveal endpoint and player tokens must exist before this frontend is deployed.

---

### Task 1: Install dependencies and initialize shadcn/ui

**Files:**
- Modify: `package.json` (via npm install)
- Create: `components.json` (via shadcn init)
- Modify: `tailwind.config.ts`
- Modify: `src/index.css`

- [ ] **Step 1: Install npm packages**

```bash
npm install react-router-dom lucide-react qrcode.react
npm install -D @types/react-router-dom
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted, choose:
- Style: Default
- Base color: Stone
- CSS variables: yes

This creates `components.json` and updates `tailwind.config.ts` and `src/index.css`.

- [ ] **Step 3: Add shadcn components**

```bash
npx shadcn@latest add button badge card input label separator
```

This creates files in `src/components/ui/`: `button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`.

- [ ] **Step 4: Override CSS variables in `src/index.css` for Stone+Amber palette**

Replace the `:root` block that shadcn generated with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 60 9% 98%;
    --foreground: 20 14% 4%;
    --card: 0 0% 100%;
    --card-foreground: 20 14% 4%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14% 4%;
    --primary: 38 92% 50%;
    --primary-foreground: 0 0% 100%;
    --secondary: 60 5% 96%;
    --secondary-foreground: 24 10% 10%;
    --muted: 60 5% 96%;
    --muted-foreground: 25 5% 45%;
    --accent: 48 96% 89%;
    --accent-foreground: 26 83% 14%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 20 6% 88%;
    --input: 20 6% 88%;
    --ring: 38 92% 50%;
    --radius: 0.5rem;
  }

  body {
    @apply bg-background text-foreground;
    font-family: system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
}
```

- [ ] **Step 5: Verify build still compiles**

```bash
npm run build
```

Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components.json tailwind.config.ts src/index.css src/components/ui/
git commit -m "feat: install react-router-dom, lucide-react, qrcode.react, shadcn/ui"
```

---

### Task 2: Update types and API layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/api/game.ts`
- Modify: `src/api/users.ts`
- Create: `src/api/reveal.ts`

- [ ] **Step 1: Replace `src/types/index.ts`**

```typescript
export type Mode = 'clasico' | 'caos' | 'ciego' | 'aliados' | 'espejo';
export type Difficulty = 'facil' | 'dificil' | 'brutal';

export interface Player {
  id: string;
  name: string;
  telegram_id: number | null;
  token: string;
}

export interface PlayerTokenOut {
  name: string;
  token: string;
}

export interface StartGameResponse {
  category: string;
  mode: Mode;
  n_impostors: number;
  sent: string[];
  failed: string[];
  session_id: string;
  players: PlayerTokenOut[];
}

export interface RevealState {
  state: 'waiting' | 'ready';
  player_name: string;
  session_id?: string;
  is_impostor?: boolean;
  category?: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  lang: string;
}
```

- [ ] **Step 2: Update `src/api/game.ts`**

```typescript
import { StartGameResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface StartGameRequest {
  players: { id: string; name: string; telegram_id: number | null; token: string }[];
  mode: string;
  difficulty: string;
  categories?: string[];
}

export async function startGame(
  req: StartGameRequest,
  token: string,
): Promise<StartGameResponse> {
  const res = await fetch(`${API_URL}/api/game/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Game start failed: ${res.status}`);
  return res.json();
}

export async function getCategories(): Promise<string[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  const data = await res.json();
  return data.categories;
}
```

- [ ] **Step 3: Update `src/api/users.ts`**

```typescript
import { Player } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

function authFetch(token: string, input: string, init?: RequestInit) {
  return fetch(`${API_URL}${input}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}

export async function listPlayers(token: string): Promise<Player[]> {
  const res = await authFetch(token, '/users/players');
  if (!res.ok) throw new Error('Failed to fetch players');
  return res.json();
}

export async function createPlayer(
  token: string,
  data: { name: string; telegram_id?: number | null },
): Promise<Player> {
  const res = await authFetch(token, '/users/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create player');
  return res.json();
}

export async function deletePlayer(token: string, playerId: string): Promise<void> {
  await authFetch(token, `/users/players/${playerId}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Create `src/api/reveal.ts`**

```typescript
import { RevealState } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export async function getRevealState(playerToken: string): Promise<RevealState> {
  const res = await fetch(`${API_URL}/p/${playerToken}`);
  if (!res.ok) throw new Error(`Reveal fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Fix any errors reported. Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/api/
git commit -m "feat: updated types and API layer for QR reveal system"
```

---

### Task 3: Create useReveal hook

**Files:**
- Create: `src/hooks/useReveal.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useEffect, useRef, useState } from 'react';
import { getRevealState } from '../api/reveal';
import { RevealState } from '../types';

export function useReveal(playerToken: string) {
  const [data, setData] = useState<RevealState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const state = await getRevealState(playerToken);
        if (!cancelled) {
          setData(state);
          if (state.state === 'ready' && intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      } catch (e) {
        if (!cancelled) setError('No se pudo conectar al servidor.');
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 3000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playerToken]);

  return { data, error };
}
```

- [ ] **Step 2: Write a unit test**

Create `src/hooks/__tests__/useReveal.test.tsx`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReveal } from '../useReveal';
import * as revealApi from '../../api/reveal';

describe('useReveal', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns waiting state on first poll', async () => {
    vi.spyOn(revealApi, 'getRevealState').mockResolvedValue({
      state: 'waiting',
      player_name: 'Camila',
    });
    const { result } = renderHook(() => useReveal('test-token'));
    await waitFor(() => expect(result.current.data?.state).toBe('waiting'));
    expect(result.current.data?.player_name).toBe('Camila');
  });

  it('sets error when fetch fails', async () => {
    vi.spyOn(revealApi, 'getRevealState').mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useReveal('bad-token'));
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });
});
```

- [ ] **Step 3: Run test**

```bash
npm test -- --reporter=verbose src/hooks/__tests__/useReveal.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useReveal.ts src/hooks/__tests__/useReveal.test.tsx
git commit -m "feat: useReveal hook with 3s polling"
```

---

### Task 4: Create WizardShell and StepPlayers

**Files:**
- Create: `src/components/wizard/WizardShell.tsx`
- Create: `src/components/wizard/StepPlayers.tsx`
- Modify: `src/hooks/usePlayers.ts` (minor: adapt to new Player type with token)

- [ ] **Step 1: Verify usePlayers returns token field**

Open `src/hooks/usePlayers.ts`. The existing `localStorage` path stores players as `{ id, name, telegram_id }`. The hook needs to also store/return `token`. For anonymous (localStorage) players, `token` will be an empty string — only authenticated (server-side) players have real tokens. Confirm the return type matches the updated `Player` interface.

If `usePlayers` returns `Player[]` from the API, it already gets `token` from the backend. For localStorage players, add `token: ''` to the local shape:

```typescript
// In usePlayers.ts, in the localStorage read path:
const raw: Array<{id:string; name:string; telegram_id:number|null; token?:string}> =
  JSON.parse(localStorage.getItem('impostor_players') ?? '[]');
return raw.map(p => ({ ...p, token: p.token ?? '' }));
```

Update the localStorage write path to persist `token`:
```typescript
localStorage.setItem('impostor_players', JSON.stringify(players));
```

- [ ] **Step 2: Create `src/components/wizard/WizardShell.tsx`**

```tsx
import { useState } from 'react';
import { useGame } from '../../hooks/useGame';
import { usePlayers } from '../../hooks/usePlayers';
import { Difficulty, Mode, StartGameResponse } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import AuthButton from '../AuthButton';
import GameInProgress from '../GameInProgress';
import StepMode from './StepMode';
import StepPlayers from './StepPlayers';
import StepReview from './StepReview';

const STEPS = ['Jugadores', 'Modo', 'Revisar'] as const;

export default function WizardShell() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<Mode>('caos');
  const [difficulty, setDifficulty] = useState<Difficulty>('dificil');
  const [gameResult, setGameResult] = useState<StartGameResponse | null>(null);

  const { players, addPlayer, removePlayer } = usePlayers();
  const { state: gameState, start, reset } = useGame();
  const { token: authToken, user } = useAuth();

  async function handlePlay() {
    if (!authToken) return;
    const result = await start({ players, mode, difficulty }, authToken);
    if (result) setGameResult(result);
  }

  function handlePlayAgain() {
    reset();
    setGameResult(null);
    setStep(1);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-xl font-bold text-stone-900 mb-2">El Impostor</p>
        <p className="text-stone-400 text-sm mb-6">Inicia sesión para jugar.</p>
        <AuthButton />
      </div>
    );
  }

  if (gameResult) {
    return <GameInProgress result={gameResult} onPlayAgain={handlePlayAgain} />;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-stone-900 tracking-tight">El Impostor</span>
        <StepBar currentStep={step} />
      </header>

      {/* Step content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        {step === 1 && (
          <StepPlayers
            players={players}
            onAdd={addPlayer}
            onRemove={removePlayer}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepMode
            mode={mode}
            difficulty={difficulty}
            onModeChange={setMode}
            onDifficultyChange={setDifficulty}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepReview
            players={players}
            mode={mode}
            difficulty={difficulty}
            loading={gameState === 'loading'}
            onBack={() => setStep(2)}
            onPlay={handlePlay}
          />
        )}
      </main>
    </div>
  );
}

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === currentStep;
        const done = n < currentStep;
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className={`h-1 w-6 rounded-full transition-colors ${
                active ? 'bg-amber-500' : done ? 'bg-stone-400' : 'bg-stone-200'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/wizard/StepPlayers.tsx`**

```tsx
import { useState } from 'react';
import { UserPlus, X, MessageCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Player } from '../../types';

interface Props {
  players: Player[];
  onAdd: (player: { name: string; telegram_id?: number | null }) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
}

export default function StepPlayers({ players, onAdd, onRemove, onNext }: Props) {
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      telegram_id: telegramId ? parseInt(telegramId, 10) : null,
    });
    setName('');
    setTelegramId('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleAdd();
  }

  const canProceed = players.length >= 3;

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-1">Jugadores</h1>
      <p className="text-stone-500 text-sm mb-6">¿Quién juega esta ronda?</p>

      {/* Player list */}
      <div className="space-y-2 mb-4">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-stone-900">{p.name}</span>
              {p.telegram_id ? (
                <MessageCircle className="w-3.5 h-3.5 text-stone-400" />
              ) : (
                <span className="text-[10px] text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">
                  sin Telegram
                </span>
              )}
            </div>
            <button
              onClick={() => onRemove(p.id)}
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {players.length === 0 && (
          <p className="text-center text-stone-400 text-sm py-6">
            Añade al menos 3 jugadores para comenzar.
          </p>
        )}
      </div>

      {/* Add form */}
      <div className="bg-white border border-stone-200 rounded-lg px-4 py-3 shadow-sm space-y-2 mb-6">
        <Input
          placeholder="Nombre del jugador"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-0 px-0 shadow-none focus-visible:ring-0 text-sm font-medium"
        />
        <Input
          placeholder="Telegram ID (opcional)"
          type="number"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          onKeyDown={handleKeyDown}
          className="border-0 border-t border-stone-100 rounded-none px-0 shadow-none focus-visible:ring-0 text-xs text-stone-400"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="flex items-center gap-1.5 text-amber-600 text-xs font-semibold disabled:opacity-40 hover:text-amber-700 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Añadir jugador
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-stone-400 text-center mb-8">
        Cada jugador escanea su QR una vez y lo guarda.
        <br />No necesitas configurar nada más.
      </p>

      <Button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full bg-stone-900 hover:bg-stone-800 text-white font-semibold tracking-wide"
        size="lg"
      >
        Siguiente
      </Button>
      {!canProceed && (
        <p className="text-center text-xs text-stone-400 mt-2">Mínimo 3 jugadores</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Fix any errors. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/wizard/ src/hooks/usePlayers.ts
git commit -m "feat: WizardShell and StepPlayers components"
```

---

### Task 5: Create StepMode

**Files:**
- Create: `src/components/wizard/StepMode.tsx`

- [ ] **Step 1: Create `src/components/wizard/StepMode.tsx`**

```tsx
import { Layers, Shield, EyeOff, Users, Shuffle } from 'lucide-react';
import { Button } from '../ui/button';
import { Difficulty, Mode } from '../../types';

const MODES: { value: Mode; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'caos', label: 'Caos', icon: Layers, desc: 'Número aleatorio de impostores' },
  { value: 'clasico', label: 'Clásico', icon: Shield, desc: 'Exactamente un impostor' },
  { value: 'ciego', label: 'Ciego', icon: EyeOff, desc: 'Nadie sabe cuántos hay' },
  { value: 'aliados', label: 'Aliados', icon: Users, desc: 'Dos impostores se conocen' },
  { value: 'espejo', label: 'Espejo', icon: Shuffle, desc: 'El impostor tiene otra palabra' },
];

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'dificil', label: 'Difícil' },
  { value: 'brutal', label: 'Brutal' },
];

interface Props {
  mode: Mode;
  difficulty: Difficulty;
  onModeChange: (m: Mode) => void;
  onDifficultyChange: (d: Difficulty) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function StepMode({
  mode, difficulty, onModeChange, onDifficultyChange, onBack, onNext,
}: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-1">Modo de juego</h1>
      <p className="text-stone-500 text-sm mb-6">Elige cómo se juega esta ronda.</p>

      {/* Mode grid */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {MODES.map(({ value, label, icon: Icon, desc }, i) => {
          const selected = mode === value;
          const isLast = i === MODES.length - 1;
          return (
            <button
              key={value}
              onClick={() => onModeChange(value)}
              className={`${isLast ? 'col-span-2' : ''} text-left flex items-start gap-3 bg-white border rounded-lg p-3.5 shadow-sm transition-colors ${
                selected
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className={`mt-0.5 ${selected ? 'text-amber-600' : 'text-stone-400'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${selected ? 'text-amber-700' : 'text-stone-800'}`}>
                  {label}
                </p>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Difficulty */}
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
        Dificultad
      </p>
      <div className="flex bg-stone-100 border border-stone-200 rounded-lg p-0.5 mb-8">
        {DIFFICULTIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onDifficultyChange(value)}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${
              difficulty === value
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1 border-stone-200 text-stone-600">
          Atrás
        </Button>
        <Button
          onClick={onNext}
          className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white font-semibold tracking-wide"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any errors. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/StepMode.tsx
git commit -m "feat: StepMode — mode grid + difficulty pill"
```

---

### Task 6: Create StepReview, GameInProgress, and QrCard

**Files:**
- Create: `src/components/wizard/StepReview.tsx`
- Create: `src/components/QrCard.tsx`
- Create: `src/components/GameInProgress.tsx`

- [ ] **Step 1: Create `src/components/wizard/StepReview.tsx`**

```tsx
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Difficulty, Mode, Player } from '../../types';

const MODE_LABELS: Record<Mode, string> = {
  caos: 'Caos', clasico: 'Clásico', ciego: 'Ciego', aliados: 'Aliados', espejo: 'Espejo',
};
const DIFF_LABELS: Record<Difficulty, string> = {
  facil: 'Fácil', dificil: 'Difícil', brutal: 'Brutal',
};

function impostorCount(mode: Mode, playerCount: number): string {
  if (mode === 'clasico') return '1';
  if (mode === 'aliados') return '2';
  if (mode === 'ciego' || mode === 'caos') return 'Aleatorio';
  if (mode === 'espejo') return `1–${Math.max(1, Math.floor(playerCount / 2))}`;
  return '1';
}

interface Props {
  players: Player[];
  mode: Mode;
  difficulty: Difficulty;
  loading: boolean;
  onBack: () => void;
  onPlay: () => void;
}

export default function StepReview({ players, mode, difficulty, loading, onBack, onPlay }: Props) {
  const rows = [
    { label: 'Jugadores', value: String(players.length) },
    { label: 'Modo', value: MODE_LABELS[mode] },
    { label: 'Dificultad', value: DIFF_LABELS[difficulty] },
    { label: 'Impostores', value: impostorCount(mode, players.length) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 tracking-tight mb-1">¿Todo listo?</h1>
      <p className="text-stone-500 text-sm mb-6">Revisa antes de empezar.</p>

      <div className="bg-white border border-stone-200 rounded-lg shadow-sm divide-y divide-stone-100 mb-4">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center px-4 py-3">
            <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
              {label}
            </span>
            <span className="text-sm font-semibold text-stone-900">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-stone-400 text-center mb-8">
        Cada jugador recibirá su rol por QR o link permanente.
        {' '}Telegram si está configurado.
      </p>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1 border-stone-200 text-stone-600"
        >
          Atrás
        </Button>
        <Button
          onClick={onPlay}
          disabled={loading}
          className="flex-[2] bg-stone-900 hover:bg-stone-800 text-white font-bold tracking-widest text-sm"
          size="lg"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'JUGAR'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/QrCard.tsx`**

```tsx
import { QRCodeSVG } from 'qrcode.react';
import { Link2, Check } from 'lucide-react';
import { useState } from 'react';
import { PlayerTokenOut } from '../types';

interface Props {
  player: PlayerTokenOut;
}

export default function QrCard({ player }: Props) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/p/${player.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm flex flex-col items-center gap-2.5">
      <p className="text-xs font-semibold text-stone-900">{player.name}</p>
      <div className="p-1.5 border border-stone-100 rounded-lg">
        <QRCodeSVG value={url} size={72} level="M" />
      </div>
      <button
        onClick={copyLink}
        className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-[10px] font-semibold transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3" />
            Copiado
          </>
        ) : (
          <>
            <Link2 className="w-3 h-3" />
            Copiar link
          </>
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/GameInProgress.tsx`**

```tsx
import { RotateCcw, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { StartGameResponse } from '../types';
import QrCard from './QrCard';

const MODE_LABELS: Record<string, string> = {
  caos: 'Caos', clasico: 'Clásico', ciego: 'Ciego', aliados: 'Aliados', espejo: 'Espejo',
};
const DIFF_LABELS: Record<string, string> = {
  facil: 'Fácil', dificil: 'Difícil', brutal: 'Brutal',
};

interface Props {
  result: StartGameResponse;
  onPlayAgain: () => void;
}

export default function GameInProgress({ result, onPlayAgain }: Props) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <header className="border-b border-stone-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-stone-900 tracking-tight">Partida en curso</span>
          <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5">
            En vivo
          </span>
        </div>
        <span className="text-xs text-stone-400">
          {MODE_LABELS[result.mode]} · {DIFF_LABELS[result.n_impostors === 1 ? 'dificil' : 'brutal']}
        </span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        <p className="text-xs text-stone-400 text-center mb-6">
          Cada jugador escanea su QR o abre su link guardado.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {result.players.map((p) => (
            <QrCard key={p.token} player={p} />
          ))}
        </div>

        <div className="space-y-2">
          <Button
            onClick={onPlayAgain}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold tracking-widest text-sm"
            size="lg"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            OTRA RONDA
          </Button>
          <Button
            variant="outline"
            onClick={onPlayAgain}
            className="w-full border-stone-200 text-stone-500 text-sm"
          >
            <Settings className="w-3.5 h-3.5 mr-2" />
            Cambiar configuración
          </Button>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Fix any errors. Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/wizard/StepReview.tsx src/components/QrCard.tsx src/components/GameInProgress.tsx
git commit -m "feat: StepReview, QrCard, GameInProgress components"
```

---

### Task 7: Create RevealPage

**Files:**
- Create: `src/pages/RevealPage.tsx`

- [ ] **Step 1: Create `src/pages/RevealPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Hand } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

function PulsingDot() {
  return (
    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse mx-auto mb-4" />
  );
}

export default function RevealPage() {
  const { token } = useParams<{ token: string }>();
  const { data, error } = useReveal(token ?? '');
  const [revealed, setRevealed] = useState(false);

  // Persist revealed state per session
  useEffect(() => {
    if (data?.state === 'ready' && data.session_id) {
      const key = `reveal_${data.session_id}`;
      if (localStorage.getItem(key) === 'true') setRevealed(true);
    }
  }, [data?.state, data?.session_id]);

  function handleReveal() {
    if (data?.session_id) {
      localStorage.setItem(`reveal_${data.session_id}`, 'true');
    }
    setRevealed(true);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-stone-900 font-semibold mb-1">No se pudo conectar</p>
          <p className="text-stone-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <PulsingDot />
      </div>
    );
  }

  // Waiting state
  if (data.state === 'waiting') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 text-center">
        <PulsingDot />
        <p className="text-lg font-bold text-stone-900 mb-1">Esperando partida</p>
        <p className="text-stone-400 text-sm">El host aún no ha iniciado la ronda.</p>
        <p className="text-amber-600 text-sm font-semibold mt-4">Hola, {data.player_name}</p>
      </div>
    );
  }

  // Ready but not yet tapped
  if (!revealed) {
    return (
      <div
        className="min-h-screen bg-stone-900 flex flex-col items-center justify-center px-6 text-center cursor-pointer select-none"
        onClick={handleReveal}
      >
        <Hand className="w-10 h-10 text-stone-600 mb-5" />
        <p className="text-xl font-bold text-white tracking-tight mb-2">
          Toca para ver tu rol
        </p>
        <p className="text-stone-500 text-sm">La partida ha comenzado</p>
        <p className="text-stone-700 text-xs mt-8">Solo tú puedes ver esto</p>
      </div>
    );
  }

  // Impostor reveal
  if (data.is_impostor) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-amber-500 text-xs font-bold uppercase tracking-widest mb-3">Tu rol</p>
        <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-4">
          Eres el<br />Impostor
        </h1>
        <div className="w-8 h-0.5 bg-amber-500 mb-4" />
        <p className="text-stone-400 text-sm leading-relaxed">
          Los demás hablan de{' '}
          <span className="text-stone-200 font-semibold">una categoría</span>.
          <br />Tú no sabes cuál.
          <br />
          <span className="text-stone-600 text-xs mt-2 block">Disimula.</span>
        </p>
      </div>
    );
  }

  // Safe player reveal
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6 text-center">
      <CheckCircle2 className="w-8 h-8 text-green-600 mb-3" />
      <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-2">Tu rol</p>
      <h1 className="text-3xl font-black text-stone-900 tracking-tight leading-none mb-5">
        No eres el<br />Impostor
      </h1>
      <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">La categoría es</p>
      <p className="text-4xl font-black text-stone-900 tracking-tight">{data.category}</p>
      <p className="text-stone-300 text-xs mt-8">No muestres esta pantalla.</p>
    </div>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any errors. Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/RevealPage.tsx
git commit -m "feat: RevealPage — waiting/tap/impostor/safe states"
```

---

### Task 8: Wire up App.tsx with React Router, update useGame, delete old components

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useGame.ts`
- Modify: `src/index.html`
- Delete: `src/components/ConfigDrawer.tsx`, `DifficultyToggle.tsx`, `ModeCard.tsx`, `GameResult.tsx`, `Tutorial.tsx`

- [ ] **Step 1: Update `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 2: Update `src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom';
import RevealPage from './pages/RevealPage';
import WizardShell from './components/wizard/WizardShell';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<WizardShell />} />
      <Route path="/p/:token" element={<RevealPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Update `src/hooks/useGame.ts` to return result and accept authToken**

The existing hook calls `startGame(req)` without a token. Update it to accept and forward the token:

```typescript
import { useState } from 'react';
import { startGame, StartGameRequest } from '../api/game';
import { StartGameResponse } from '../types';

type GameState = 'idle' | 'loading' | 'result' | 'error';

export function useGame() {
  const [state, setState] = useState<GameState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function start(req: StartGameRequest, authToken: string): Promise<StartGameResponse | null> {
    setState('loading');
    setError(null);
    try {
      const result = await startGame(req, authToken);
      setState('result');
      return result;
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'Error desconocido');
      return null;
    }
  }

  function reset() {
    setState('idle');
    setError(null);
  }

  return { state, error, start, reset };
}
```

- [ ] **Step 4: Update `index.html` — remove Nunito, add Inter**

In `/Users/marco/Desktop/programming/github/impostor-web/index.html`, replace the font link with Inter:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
```

And update `src/index.css` body font:
```css
body {
  @apply bg-background text-foreground;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 5: Delete old components**

```bash
rm src/components/ConfigDrawer.tsx
rm src/components/DifficultyToggle.tsx
rm src/components/ModeCard.tsx
rm src/components/GameResult.tsx
rm src/components/Tutorial.tsx
```

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Fix any remaining import errors (old component imports may linger in test files — update or remove them).

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --reporter=verbose
```

Expected: all existing passing tests still pass, new useReveal tests pass.

- [ ] **Step 8: Run build**

```bash
npm run build
```

Expected: exit 0, no TypeScript errors, no missing module errors.

- [ ] **Step 9: Commit**

```bash
git add src/main.tsx src/App.tsx src/hooks/useGame.ts index.html src/index.css
git rm src/components/ConfigDrawer.tsx src/components/DifficultyToggle.tsx
git rm src/components/ModeCard.tsx src/components/GameResult.tsx src/components/Tutorial.tsx
git commit -m "feat: wire React Router, remove old components, lint+build clean"
```

---

### Task 9: Deploy to Railway and smoke test

- [ ] **Step 1: Push to GitHub (triggers Railway deploy)**

```bash
cd /Users/marco/Desktop/programming/github/impostor-web
git push origin main
```

- [ ] **Step 2: Monitor Railway build**

```bash
railway logs --service impostor-web
```

Wait for "Build succeeded" and "Started server".

- [ ] **Step 3: Smoke test the live app**

```bash
# Home loads (wizard step 1)
curl -s -o /dev/null -w "%{http_code}" https://impostor-web-production-51ff.up.railway.app/
# Expected: 200

# Reveal page with unknown token loads (not 500)
curl -s -o /dev/null -w "%{http_code}" https://impostor-web-production-51ff.up.railway.app/p/bogus
# Expected: 200 (SPA serves index.html, RevealPage handles 404 from API gracefully)
```

- [ ] **Step 4: Run Alembic migrations on Railway Postgres (if not already done)**

```bash
cd /Users/marco/Desktop/programming/github/impostor-api
export $(railway variables --service impostor-api | xargs)
alembic upgrade head
```

- [ ] **Step 5: Final lint + build confirmation**

```bash
cd /Users/marco/Desktop/programming/github/impostor-web
npm run lint && npm run build
```

Expected: exit 0 for both.
