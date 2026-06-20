# El Impostor v2 — Design Spec

**Date:** 2026-06-19  
**Repos:** `impostor-api` (backend) · `impostor-web` (frontend)  
**Status:** Approved for implementation

---

## 1. Overview

Six features added on top of the working v1 base:

| # | Feature | Scope |
|---|---------|-------|
| A | Gameplay improvements (word difficulty, category selection, impostor count) | api + web |
| B | Tutorial — cómo encontrar tu Telegram ID | web |
| C | Historial de partidas | api + web |
| D | i18n — Español / Inglés | api + web |
| E | Google Ads (solo usuarios sin cuenta) | web |
| F | Cuentas opcionales — Google OAuth + SQLite/Postgres | api + web |

**Guiding principle:** The game always works without an account. Auth unlocks sync and history. Every layer (DB, auth, i18n, ads) is independently testable.

---

## 2. Architecture

```
Browser (impostor-web)
┌───────────────────────────────────────────────────────┐
│  Google OAuth ──► JWT en localStorage                 │
│                                                       │
│  Sin cuenta               Con cuenta                  │
│  ─────────────            ─────────────────────────   │
│  Jugadores localStorage   Jugadores sync'd en DB      │
│  Historial localStorage   Historial completo en DB    │
│  Ve AdSlots               Sin ads                     │
│  Idioma localStorage      Idioma en DB                │
│                                                       │
│  react-i18next (ES/EN) · Tailwind · Vite              │
└──────────────────────────┬────────────────────────────┘
                           │ REST / Bearer JWT
┌──────────────────────────▼────────────────────────────┐
│  FastAPI (impostor-api)                               │
│                                                       │
│  Auth layer (authlib + python-jose)                   │
│  Optional JWT middleware — unprotected routes work    │
│                                                       │
│  SQLAlchemy (async) + Alembic                         │
│  Dev: SQLite    Prod: Postgres (env switch)           │
│                                                       │
│  OpenRouter LLM — pick_word / pick_hint / validate    │
│  Telegram Bot  — message delivery                     │
└───────────────────────────────────────────────────────┘
```

---

## 3. Database

### 3.1 Engine config (`app/db.py`)

```python
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./impostor.db")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)
```

Switching to Postgres in production = set `DATABASE_URL=postgresql+asyncpg://...` in `.env`. Zero code change.

### 3.2 Schema

```sql
-- users
id          TEXT PRIMARY KEY  -- UUID
google_id   TEXT UNIQUE NOT NULL
email       TEXT NOT NULL
name        TEXT NOT NULL
lang        TEXT NOT NULL DEFAULT 'es'
created_at  TIMESTAMP NOT NULL DEFAULT NOW()

-- players (synced, replaces localStorage for auth'd users)
id          TEXT PRIMARY KEY  -- UUID
user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
name        TEXT NOT NULL
telegram_id BIGINT NOT NULL
created_at  TIMESTAMP NOT NULL DEFAULT NOW()

-- game_rounds (history)
id          TEXT PRIMARY KEY  -- UUID
user_id     TEXT REFERENCES users(id) ON DELETE SET NULL  -- NULL = anonymous
mode        TEXT NOT NULL
difficulty  TEXT NOT NULL
word_difficulty TEXT NOT NULL DEFAULT 'popular'
category    TEXT NOT NULL
n_impostors INTEGER NOT NULL
sent        TEXT NOT NULL  -- JSON array of player names
failed      TEXT NOT NULL  -- JSON array of player names
played_at   TIMESTAMP NOT NULL DEFAULT NOW()

-- saved_categories
id          TEXT PRIMARY KEY  -- UUID
user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
name        TEXT NOT NULL
created_at  TIMESTAMP NOT NULL DEFAULT NOW()
UNIQUE(user_id, name)
```

Anonymous rounds are not saved to the DB. The client manages its own localStorage history (capped at 20 entries) for anonymous users.

### 3.3 Migrations

Alembic with `env.py` pointing to `app.db.Base.metadata`. First migration creates all four tables. Subsequent migrations use `alembic revision --autogenerate`.

---

## 4. Backend API Changes

### 4.1 New dependencies

```
# requirements.txt additions
sqlalchemy[asyncio]>=2.0
aiosqlite>=0.20          # SQLite async driver (dev)
asyncpg>=0.29            # Postgres async driver (prod, optional import)
alembic>=1.13
authlib>=1.3
python-jose[cryptography]>=3.3
httpx>=0.27              # already in dev, move to prod for Google token fetch
```

### 4.2 Auth layer (`app/auth.py`)

**Flow:**
1. Frontend sends `{ code, redirect_uri }` to `POST /auth/google`
2. Backend exchanges code for Google access token via `authlib`
3. Fetches Google userinfo (`email`, `name`, `sub`)
4. Upserts `users` row on `google_id`
5. Returns signed JWT (`python-jose`, `HS256`, 30-day expiry)

**Middleware:**
```python
# Optional auth — does NOT block unauthenticated requests
async def get_current_user_optional(token: str | None = Depends(oauth2_scheme)) -> User | None:
    if not token:
        return None
    try:
        return verify_jwt(token)
    except JWTError:
        return None
```

Routes that need auth use `Depends(get_current_user)` (raises 401). Routes that are enhanced by auth use `Depends(get_current_user_optional)` (returns None if no token).

### 4.3 Full endpoint surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | none | liveness |
| POST | `/auth/google` | none | exchange Google code → JWT |
| GET | `/auth/me` | required | current user info |
| DELETE | `/auth/me` | required | delete account + cascade |
| GET | `/api/categories` | optional | default categories; if auth'd, also returns user's saved categories |
| POST | `/api/categories/validate` | none | LLM validates proposed category |
| POST | `/api/game/start` | optional | run a round; saves to history if auth'd |
| GET | `/users/players` | required | list synced players |
| POST | `/users/players` | required | add player |
| DELETE | `/users/players/{id}` | required | remove player |
| GET | `/users/history` | required | paginated game history |
| GET | `/users/categories` | required | saved categories |
| POST | `/users/categories` | required | save a category |
| DELETE | `/users/categories/{id}` | required | remove saved category |
| PATCH | `/users/preferences` | required | update lang preference |

### 4.4 StartGameRequest — new fields

```python
class StartGameRequest(BaseModel):
    players: list[Player]
    mode: Mode = Mode.caos
    difficulty: Difficulty = Difficulty.dificil
    word_difficulty: WordDifficulty = WordDifficulty.popular  # NEW
    categories: list[str] | None = None
    lang: str = "es"  # NEW — controls Telegram message language
    n_impostors: int | None = None  # NEW — override for clasico mode
```

```python
class WordDifficulty(str, Enum):
    popular = "popular"   # Messi, Coca-Cola, perro
    obscuro = "obscuro"   # jugador colombiano de 3ra división
```

### 4.5 LLM prompt changes

**`pick_word(category, word_difficulty)`** — two prompt variants:
- `popular`: `"Give me one very famous, universally known {category}. One word or short name only."`
- `obscuro`: `"Give me one very obscure, niche, or uncommon {category} that most people wouldn't know. One word or short name only."`

**`validate_category(name)`** — new method on LLMProvider:
- Prompt: `"Is '{name}' a valid category for a word-guessing party game? It should be concrete, have many possible members, and be appropriate for all ages. Reply with only YES or NO."`
- Returns `bool`. If LLM response doesn't contain YES/NO clearly, default to `False`.
- Cached in-memory (TTL 10 min) to avoid burning tokens on repeated submissions.

**`pick_hint` / `pick_mirror_word`** — unchanged.

### 4.6 i18n in Telegram messages

`engine.py` receives `lang: str` and uses a message builder keyed by language:

```python
MESSAGES = {
    "es": {
        "category": "📂 Categoría",
        "word": "🔤 Tu palabra",
        "impostor": "🎭 ¡Eres el IMPOSTOR!",
        ...
    },
    "en": {
        "category": "📂 Category",
        "word": "🔤 Your word",
        "impostor": "🎭 You are the IMPOSTOR!",
        ...
    }
}
```

### 4.7 History persistence

`engine.run()` accepts optional `user_id: str | None`. If provided, saves a `game_rounds` row after the round completes. Anonymous games are never saved to DB.

---

## 5. Frontend Changes

### 5.1 New dependencies

```json
"react-i18next": "^14",
"i18next": "^23",
"i18next-browser-languagedetector": "^7"
```

No new routing library — still single-page, no react-router.

### 5.2 i18n setup (`src/i18n/`)

```
src/i18n/
  index.ts          — i18next init, language detector, fallback to 'es'
  locales/
    es/
      common.json   — all Spanish strings
    en/
      common.json   — all English strings
```

Language stored in localStorage key `impostor_lang`. If user has account and changes language, also PATCHes `/users/preferences`.

### 5.3 New hooks

| Hook | What it does |
|------|-------------|
| `useAuth` | Google OAuth popup flow, JWT storage, `{ user, login, logout, isLoading }` |
| `useHistory` | Loads history from localStorage (anon) or `/users/history` (auth'd), provides `addRound(result)` |
| `useCategories` | Loads `/api/categories`, handles custom category validation flow |

**`usePlayers` changes:** When `useAuth` returns a user, switches from localStorage to `/users/players` API. On login, merges existing localStorage players into the DB: deduplicates by `telegram_id` — if a conflict exists, the DB version wins and the localStorage entry is discarded.

### 5.4 New / changed components

| Component | Type | Description |
|-----------|------|-------------|
| `AuthButton` | new | "Continuar con Google" button. On click opens Google OAuth popup. Shows user avatar + name when logged in, with logout option. |
| `LanguageSelector` | new | ES/EN toggle in header, 2 letters pill. |
| `CategorySelector` | new | Toggle "Aleatoria / Elegir". When Elegir: list of default + saved categories as chips, + "Proponer categoría" input that calls `/api/categories/validate`. |
| `ImpostorCountSlider` | new | Visible only in `clasico` mode. Slider 1..max(1, floor(n_players/2)). Hidden when fewer than 2 players configured. |
| `HistoryDrawer` | new | Slide-in drawer (same pattern as ConfigDrawer). Lists past rounds: date, category, mode, sent/failed counts. Paginated if auth'd. |
| `AdSlot` | new | Renders `<ins class="adsbygoogle">` block only when `!user && VITE_ADSENSE_ID`. Noop in dev if env var absent. |
| `Tutorial` | changed | Step 2 now links to `https://t.me/userinfobot` and shows a visual step diagram (SVG or styled divs). |
| `GameResult` | changed | Calls `history.addRound(result)` after each game. Shows "Inicia sesión para guardar tu historial" nudge if not auth'd. |
| `App` | changed | Adds `useAuth`, `useHistory`, `useCategories`. Header gains `AuthButton` + `LanguageSelector` + history icon. Main area gains `CategorySelector` + `ImpostorCountSlider`. |

### 5.5 Header layout (updated)

```
[ El Impostor ]    [ ES|EN ]  [ 🕐 ]  [ ⚙️ ]  [ Google Avatar / Login ]
                              history  config
```

### 5.6 Feature gate UX

When an unauthenticated user tries to access a gated feature, show an inline nudge (not a modal block):

- History drawer: shows last 20 rounds from localStorage + banner "Inicia sesión para ver tu historial completo en todos tus dispositivos"
- Player sync: ConfigDrawer shows "Inicia sesión para sincronizar tus jugadores" below the list

No hard blocks — the game always works without an account.

---

## 6. Google Ads

- `VITE_ADSENSE_ID` env var controls whether AdSense loads
- In `index.html`: `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<ID>" crossorigin="anonymous"></script>` — injected only if env var set
- `<AdSlot />` component renders a banner slot. Conditions to render: `!user && !!import.meta.env.VITE_ADSENSE_ID`
- Two placements: below header (leaderboard 728×90), between result and CTA (rectangle 336×280)
- In dev/test, `VITE_ADSENSE_ID` is not set → no ad code runs → no test pollution

---

## 7. Testing

### 7.1 Backend (`impostor-api`)

- All existing tests kept. New tests:
  - `tests/test_auth.py` — Google token exchange mocked with `respx`, JWT validation, `/auth/me`
  - `tests/test_users.py` — CRUD players, CRUD categories, history write + read (all with in-memory SQLite)
  - `tests/test_game_auth.py` — round saves history row when JWT provided
  - `tests/test_categories.py` — validate_category: YES path, NO path, ambiguous path (defaults False)
- DB fixture in `conftest.py`: `async_engine` pointed at `sqlite+aiosqlite:///:memory:`, tables created via `Base.metadata.create_all`, dropped after each test module
- `mock_llm` extended with `validate_category` method returning `True`

### 7.2 Frontend (`impostor-web`)

- Vitest + `@testing-library/react` + `@testing-library/user-event`
- Tests:
  - `useAuth` — login sets JWT, logout clears it, expired JWT triggers logout
  - `usePlayers` — anon uses localStorage, auth'd switches to API (mock fetch)
  - `useHistory` — addRound saves to localStorage (anon); when auth'd, POSTs to history endpoint
  - `CategorySelector` — validate flow: input → debounce → API call → shows valid/invalid state
  - `AdSlot` — renders when env var set + no user; renders nothing otherwise
- CI updated: `npm run test -- --run` added before build step

### 7.3 Coverage targets

- Backend: all new endpoints covered with at least happy path + 401 path
- Frontend: hooks 100%, new components with branching logic (AdSlot, CategorySelector) 100%

---

## 8. Migration path SQLite → Postgres

1. Set `DATABASE_URL=postgresql+asyncpg://user:pass@host/db` in production `.env`
2. Run `alembic upgrade head` against Postgres — same migrations, different driver
3. No code changes required
4. For existing SQLite data: one-time migration script `scripts/migrate_sqlite_to_pg.py` (reads SQLite, inserts into Postgres in batches)

---

## 9. File structure after changes

### impostor-api additions

```
app/
  db.py                  — engine, session factory, Base
  auth.py                — JWT helpers, Google OAuth exchange, optional middleware
  models_db.py           — SQLAlchemy ORM models (User, Player, GameRound, SavedCategory)
  routes/
    auth.py              — /auth/google, /auth/me, DELETE /auth/me
    users.py             — /users/players, /users/history, /users/categories, /users/preferences
    categories.py        — /api/categories, /api/categories/validate
  providers/
    llm/
      openrouter.py      — +validate_category, +word_difficulty param in pick_word
  game/
    engine.py            — +lang param, +user_id param, +n_impostors override
alembic/
  env.py
  versions/
    0001_initial.py
scripts/
  migrate_sqlite_to_pg.py
```

### impostor-web additions

```
src/
  i18n/
    index.ts
    locales/es/common.json
    locales/en/common.json
  hooks/
    useAuth.ts           — new
    useHistory.ts        — new
    useCategories.ts     — new
    usePlayers.ts        — updated
  components/
    AuthButton.tsx       — new
    LanguageSelector.tsx — new
    CategorySelector.tsx — new
    ImpostorCountSlider.tsx — new
    HistoryDrawer.tsx    — new
    AdSlot.tsx           — new
    Tutorial.tsx         — updated
    GameResult.tsx       — updated
    App.tsx              — updated
  types/
    index.ts             — +WordDifficulty, +HistoryEntry, +AuthUser
  api/
    game.ts              — updated (word_difficulty, lang, n_impostors)
    auth.ts              — new
    users.ts             — new
```

---

## 10. Out of scope (this spec)

- Push notifications
- Multiplayer rooms / real-time state sync
- Admin dashboard
- Social sharing of results
- Paid tiers beyond feature gating
