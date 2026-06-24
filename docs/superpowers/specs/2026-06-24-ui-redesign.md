# El Impostor — UI Redesign & QR Reveal System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-page purple dark UI with a polished light-mode wizard (Stone/Amber palette, Lucide icons, shadcn/ui components) and add a permanent per-player QR/link reveal system that replaces Telegram as the primary game delivery channel.

**Architecture:** Three-step wizard (Players → Mode+Difficulty → Review) on the host side. Each player gets a permanent token URL (`/p/:token`) that shows "waiting" before the game and their role+category after the host presses JUGAR. The reveal page polls the API every 3s. Telegram sending stays as a best-effort bonus for players who have a telegram_id.

**Tech Stack:** React 18, React Router v6, shadcn/ui, Lucide React, qrcode.react, Tailwind CSS (stone + amber palette), FastAPI backend with two new Alembic migrations.

---

## Design Decisions

### Visual Language
- **Palette:** stone-50 background (`#fafaf7`), stone-900 for headings, stone-600 for secondary text, stone-200 for borders. Amber-600 as the single accent (CTAs, active states, progress bar).
- **No emojis anywhere.** All icons from Lucide React.
- **Cards** use white background + `shadow-sm` (1px border + subtle drop shadow). No purple, no dark mode.
- **Typography:** System font stack (Inter if loaded, otherwise system-ui). No Nunito.
- **Step bar:** 3 amber segments, inactive segments stone-200, completed segments stone-400/40.

### Wizard Flow
1. **Step 1 — Jugadores:** list of players with add/remove. Minimum 3 to proceed. Players stored server-side (authenticated) or localStorage (anonymous). `telegram_id` is now optional.
2. **Step 2 — Modo + Dificultad:** 2×2 grid of mode cards (5 modes, last one spans full width), plus a 3-segment pill for difficulty.
3. **Step 3 — ¿Listo?:** summary card (players count, mode, difficulty, impostor count preview) + JUGAR button. On submit → transitions to "Partida en curso" screen with QR grid.

### QR / Reveal System
- Each `Player` DB row gets a permanent `token` (UUID). Never changes, never expires.
- On game start, the API creates a `GameSession` and one `GamePlayerResult` per player recording their role and the category they see.
- `GET /p/{token}` (public, no auth) returns `{ state: "waiting" | "ready", player_name, is_impostor?, category? }`.
- The reveal page (`/p/:token`) polls every 3s. On `state=ready` it switches to "Toca para revelar" full-screen. Tap → flip → show role. The revealed state is stored in `localStorage` keyed by `session_id` so re-opening shows the role directly.
- Host screen shows a QR per player (using `qrcode.react`) plus a "Copiar link" button per player.

### Telegram (optional, best-effort)
- `telegram_id` is no longer required when creating a player. If present, the game start logic still attempts to send a Telegram message — but the game proceeds regardless of success.
- Players without `telegram_id` rely exclusively on the QR/link reveal.

---

## File Map

### Frontend (`impostor-web/`)

**New files:**
- `src/pages/RevealPage.tsx` — the `/p/:token` player reveal page (polls API, shows waiting/tap/role states)
- `src/components/wizard/WizardShell.tsx` — step indicator bar + step routing logic
- `src/components/wizard/StepPlayers.tsx` — step 1: player list + add form
- `src/components/wizard/StepMode.tsx` — step 2: mode grid + difficulty pill
- `src/components/wizard/StepReview.tsx` — step 3: summary + JUGAR button
- `src/components/GameInProgress.tsx` — post-JUGAR screen with QR grid per player
- `src/components/QrCard.tsx` — single player QR card (QR + name + copy link button)
- `src/api/reveal.ts` — `getRevealState(token)` → `GET /p/{token}`
- `src/hooks/useReveal.ts` — polls `getRevealState` every 3s, returns `{ state, playerName, isImpostor, category }`

**Modified files:**
- `src/App.tsx` — replace all current UI with `<WizardShell>` + route to `<RevealPage>` via React Router
- `src/main.tsx` — wrap app in `<BrowserRouter>`
- `src/api/game.ts` — update `StartGameResponse` type to include `session_id` and `players` array with `{ name, token }`
- `src/api/users.ts` — `telegram_id` becomes `number | null` in `PlayerCreate`
- `src/types/index.ts` — add `PlayerToken`, `RevealState`, `GameInProgressResult` types
- `src/components/ui/Button.tsx` — replace with shadcn Button (keep same API)
- `src/components/ui/Badge.tsx` — replace with shadcn Badge
- `tailwind.config.ts` — extend theme with stone + amber as primary palette
- `index.html` — remove Nunito font import, keep Inter from Google Fonts
- `src/index.css` — update base styles for light mode

**Deleted:**
- `src/components/ConfigDrawer.tsx` — replaced by StepPlayers
- `src/components/DifficultyToggle.tsx` — replaced by StepMode
- `src/components/ModeCard.tsx` — replaced by StepMode
- `src/components/GameResult.tsx` — replaced by GameInProgress
- `src/components/Tutorial.tsx` — replaced by inline onboarding in StepPlayers

### Backend (`impostor-api/`)

**New files:**
- `alembic/versions/<hash>_player_token_and_game_sessions.py` — migration generated with `alembic revision --autogenerate -m "player_token_and_game_sessions"`: add `players.token`, make `players.telegram_id` nullable, create `game_sessions` + `game_player_results` tables
- `app/routes/reveal.py` — `GET /p/{token}` public endpoint

**Modified files:**
- `app/models_db.py` — add `Player.token`, make `Player.telegram_id` nullable, add `GameSession` + `GamePlayerResult` models
- `app/models.py` — `Player.telegram_id` → `int | None`, add `StartGameResponse.session_id` + `players: list[PlayerTokenOut]`
- `app/routes/users.py` — `PlayerCreate.telegram_id` → `int | None`
- `app/routes/game.py` (or `app/game/`) — on game start: create `GameSession` + `GamePlayerResult` rows, return `session_id` + per-player tokens
- `app/main.py` — register `reveal` router

---

## Database Schema (new tables)

```sql
-- Migration: add token to players, make telegram_id nullable
ALTER TABLE players ADD COLUMN token VARCHAR NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE players ALTER COLUMN telegram_id DROP NOT NULL;
CREATE UNIQUE INDEX players_token_idx ON players(token);

-- New tables
CREATE TABLE game_sessions (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR NOT NULL,
  mode VARCHAR NOT NULL,
  difficulty VARCHAR NOT NULL,
  n_impostors INT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE game_player_results (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player_name VARCHAR NOT NULL,  -- snapshot at time of game
  is_impostor BOOLEAN NOT NULL,
  category_shown VARCHAR NOT NULL  -- differs for "espejo" mode
);
```

---

## API Changes

### `GET /p/{token}` (new, public)
Returns the latest game state for a player token.

```json
// Waiting (no active game or game not started)
{ "state": "waiting", "player_name": "Camila" }

// Ready (game started)
{ "state": "ready", "player_name": "Camila", "session_id": "abc123",
  "is_impostor": false, "category": "Perro" }

// Impostor
{ "state": "ready", "player_name": "Camila", "session_id": "abc123",
  "is_impostor": true, "category": null }
```

Logic: find the `Player` by `token`. Join to `game_player_results` → `game_sessions`, order by `game_sessions.created_at DESC`, take the first row. If no row exists, return `waiting`.

### `POST /api/game/start` (modified response)
New fields added to `StartGameResponse`:

```json
{
  "category": "Perro",
  "mode": "caos",
  "n_impostors": 1,
  "sent": ["Marco"],
  "failed": ["Sebas"],
  "session_id": "abc123",
  "players": [
    { "name": "Marco",  "token": "x7k2m" },
    { "name": "Camila", "token": "y9p1n" },
    { "name": "Sebas",  "token": "z3r8q" }
  ]
}
```

The frontend builds the full URL as `${window.location.origin}/p/${token}` — no extra env var needed.

### `POST /users/players` (modified)
`telegram_id` is now optional:
```json
{ "name": "Sebas" }               // OK — no Telegram
{ "name": "Marco", "telegram_id": 123456789 }  // OK — with Telegram
```

---

## Component Specs

### `WizardShell`
- Props: none (manages its own step state with `useState`)
- Renders: step indicator bar (3 amber dots/segments) + current step component
- State: `step: 1 | 2 | 3`, `mode`, `difficulty`, `gameResult`. **Player state comes from the existing `usePlayers` hook** (handles server/localStorage sync automatically). `players`, `addPlayer`, `removePlayer` from `usePlayers` are passed as props to `StepPlayers`.
- When `gameResult` is set → renders `<GameInProgress>` instead of wizard

### `StepPlayers`
- Shows current player list (cards with name + optional telegram icon + remove X button)
- Add form: name input + optional telegram ID input (secondary, smaller, with info tooltip: "Para recibir pista por Telegram")
- "Sin Telegram" indicator on player cards that have no telegram_id — shown as a small muted badge, not an error
- Disabled "Siguiente" if fewer than 3 players
- First-time hint: "Cada jugador escanea su QR una vez y lo guarda. No necesitas configurar nada más."

### `StepMode`
- Mode grid: 5 modes in a 2×2 grid + 1 full-width card. Each card: Lucide icon + name + 1-line description.
- Mode icons: Layers (caos), Shield (clásico), EyeOff (ciego), Users (aliados), Shuffle (espejo)
- Difficulty pill: 3 segments — Fácil / Difícil / Brutal. Active = amber-600 bg, white text.
- Selected mode card: amber-100 bg + amber-600 border

### `StepReview`
- Summary card (white, shadow-sm): jugadores count, modo, dificultad, impostores (computed from mode+player count)
- Info line: "Se enviará la categoría a cada jugador por QR/link. Telegram si está configurado."
- JUGAR button: stone-900 bg, white text, full width, large. Shows spinner on loading.

### `GameInProgress`
- Header: "Partida en curso" + amber badge "EN VIVO" + game metadata (mode, difficulty)
- Grid: 2 or 3 columns of `<QrCard>` components, one per player
- Bottom: "OTRA RONDA" button (stone-900) + "Cambiar configuración" ghost button

### `QrCard`
- White card, shadow-sm, centered
- Player name (stone-900, 12px, semibold)
- QR code (60×60 via `qrcode.react`, quiet zone 1)
- "Copiar link" button (amber text, small, copies URL to clipboard via navigator.clipboard)

### `RevealPage` (`/p/:token`)
- **Waiting state:** stone-50 bg, centered, amber pulsing dot, "Esperando partida" heading, "Hola, {name}" subtext
- **Ready state — before tap:** stone-900 bg, centered, Hand icon (Lucide), "Toca para ver tu rol" heading
- **Revealed — not impostor:** stone-50 bg, CheckCircle2 icon (green-600), "No eres el Impostor" heading, category name large, "No muestres esta pantalla" warning (muted)
- **Revealed — impostor:** stone-900 bg, white text, "Eres el Impostor" heading, "Los demás hablan de un {category-type}. Tú no sabes cuál. Disimula." — no category shown
- Revealed state persisted in `localStorage` key `reveal_{session_id}` so refresh shows role directly

---

## Scope Boundaries (YAGNI)

- **No dark mode.** Light only.
- **No animations** beyond the pulsing dot on waiting and a CSS opacity transition on reveal.
- **No QR scanning** from the host side (players open link manually or scan).
- **No game history UI** in this spec — `game_sessions` table exists for a future feature.
- **No real-time websockets** — polling every 3s is sufficient.
- **No multi-language** in this redesign.
- Tutorial content is replaced by a single inline hint on StepPlayers. No accordion.
