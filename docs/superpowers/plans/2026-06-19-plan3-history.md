# Game History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save game round history — locally in localStorage for anonymous users (last 20 rounds), in the database for authenticated users — and surface it in a slide-in HistoryDrawer.

**Architecture:** Backend gains a `GameRound` ORM model + `/users/history` endpoint. `engine.run()` optionally saves a round when a `user_id` is provided. Frontend gains a `useHistory` hook (localStorage or API), a `HistoryDrawer` component, and `GameResult` saves the round after every game. Anonymous users see a nudge to sign in for full history.

**Tech Stack:** Same stack as Plan 1 + Plan 2. Prerequisite: Plan 1 (DB + Auth) must be complete.

---

## File Map

### impostor-api

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/models_db.py` | Add `GameRound` ORM model |
| Modify | `app/game/engine.py` | Accept `user_id`, save `GameRound` after game |
| Modify | `app/routes/game.py` | Extract user_id from optional JWT, pass to engine |
| Create | `app/routes/history.py` | GET /users/history (paginated) |
| Modify | `app/main.py` | Include history router |
| Create migration | | `add_game_rounds` table |
| Create | `tests/test_history.py` | History endpoints + engine saves round |

### impostor-web

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `HistoryEntry` type |
| Create | `src/api/history.ts` | GET /users/history API call |
| Create | `src/hooks/useHistory.ts` | localStorage (anon) or API (auth'd), `addRound` |
| Create | `src/components/HistoryDrawer.tsx` | Slide-in list of past rounds |
| Modify | `src/components/GameResult.tsx` | Call `addRound` after each game |
| Modify | `src/App.tsx` | Mount HistoryDrawer, pass useHistory |
| Create | `src/hooks/__tests__/useHistory.test.tsx` | Hook tests |

---

## Task 1: Backend — GameRound ORM model + migration

**Files:**
- Modify: `app/models_db.py`
- New migration

- [ ] **Step 1: Write failing test**

Create `tests/test_history.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db import Base, _new_uuid
from app.models_db import User, GameRound
import json


@pytest.fixture
async def mem_engine_history():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


async def test_create_game_round(mem_engine_history):
    factory = async_sessionmaker(mem_engine_history, expire_on_commit=False)
    async with factory() as s:
        user = User(id=_new_uuid(), google_id="g-hist", email="h@h.com", name="Historia")
        s.add(user)
        await s.commit()

        round_ = GameRound(
            id=_new_uuid(),
            user_id=user.id,
            mode="clasico",
            difficulty="dificil",
            word_difficulty="popular",
            category="animal",
            n_impostors=1,
            sent=json.dumps(["Marco", "Pipe"]),
            failed=json.dumps([]),
        )
        s.add(round_)
        await s.commit()
        await s.refresh(round_)

    assert round_.id is not None
    assert round_.category == "animal"
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_history.py::test_create_game_round -v
```

Expected: `ImportError: cannot import name 'GameRound'`

- [ ] **Step 3: Add GameRound to app/models_db.py**

Add after `SavedCategory`:

```python
class GameRound(Base):
    __tablename__ = "game_rounds"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    mode: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)
    word_difficulty: Mapped[str] = mapped_column(String, nullable=False, default="popular")
    category: Mapped[str] = mapped_column(String, nullable=False)
    n_impostors: Mapped[int] = mapped_column(nullable=False)
    sent: Mapped[str] = mapped_column(String, nullable=False)   # JSON array of names
    failed: Mapped[str] = mapped_column(String, nullable=False)  # JSON array of names
    played_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 4: Run test — expect pass**

```bash
pytest tests/test_history.py::test_create_game_round -v
```

Expected: `1 passed`

- [ ] **Step 5: Generate and run migration**

```bash
alembic revision --autogenerate -m "add_game_rounds"
alembic upgrade head
```

Expected: `game_rounds` table created.

- [ ] **Step 6: Commit**

```bash
git add app/models_db.py alembic/ tests/test_history.py
git commit -m "feat: GameRound ORM model + migration"
```

---

## Task 2: Backend — engine saves round + /users/history endpoint

**Files:**
- Modify: `app/game/engine.py`
- Modify: `app/routes/game.py`
- Create: `app/routes/history.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests**

In `tests/test_history.py`, add:

```python
import pytest
from unittest.mock import patch, AsyncMock
from app.auth import create_access_token
from app.models_db import User
from app.db import _new_uuid


@pytest.fixture
async def auth_user_h(db_session):
    user = User(id=_new_uuid(), google_id="g-h2", email="h2@h.com", name="HistUser")
    db_session.add(user)
    await db_session.commit()
    return user


async def test_game_saves_history_when_authenticated(client, auth_user_h, mock_llm, mock_messaging):
    token = create_access_token(auth_user_h.id)
    with patch("app.routes.game.get_llm", return_value=mock_llm), \
         patch("app.routes.game.get_messaging", return_value=mock_messaging):
        resp = await client.post(
            "/api/game/start",
            json={
                "players": [
                    {"name": "A", "telegram_id": 1},
                    {"name": "B", "telegram_id": 2},
                ],
                "mode": "clasico",
                "difficulty": "dificil",
                "word_difficulty": "popular",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200

    history_resp = await client.get(
        "/users/history", headers={"Authorization": f"Bearer {token}"}
    )
    assert history_resp.status_code == 200
    data = history_resp.json()
    assert len(data["rounds"]) == 1
    assert data["rounds"][0]["category"] == "perro" or data["rounds"][0]["mode"] == "clasico"


async def test_game_does_not_save_history_anonymous(client, mock_llm, mock_messaging):
    with patch("app.routes.game.get_llm", return_value=mock_llm), \
         patch("app.routes.game.get_messaging", return_value=mock_messaging):
        resp = await client.post(
            "/api/game/start",
            json={
                "players": [
                    {"name": "A", "telegram_id": 1},
                    {"name": "B", "telegram_id": 2},
                ],
                "mode": "clasico",
                "difficulty": "dificil",
                "word_difficulty": "popular",
            },
        )
    assert resp.status_code == 200
    # No auth — history endpoint should return 401
    history_resp = await client.get("/users/history")
    assert history_resp.status_code == 401


async def test_history_pagination(client, auth_user_h, mock_llm, mock_messaging):
    token = create_access_token(auth_user_h.id)
    headers = {"Authorization": f"Bearer {token}"}
    # Create 3 rounds
    with patch("app.routes.game.get_llm", return_value=mock_llm), \
         patch("app.routes.game.get_messaging", return_value=mock_messaging):
        for _ in range(3):
            await client.post(
                "/api/game/start",
                json={"players": [{"name": "A", "telegram_id": 1}, {"name": "B", "telegram_id": 2}],
                      "mode": "clasico", "difficulty": "dificil", "word_difficulty": "popular"},
                headers=headers,
            )
    resp = await client.get("/users/history?page=1&per_page=2", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["rounds"]) == 2
    assert data["total"] == 3
```

- [ ] **Step 2: Update app/game/engine.py to accept db + user_id and save round**

```python
import json
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import _new_uuid
from app.models_db import GameRound

class GameEngine:
    def __init__(self, llm, messaging):
        self._llm = llm
        self._messaging = messaging

    async def run(
        self,
        players,
        categories,
        mode=Mode.caos,
        difficulty=Difficulty.dificil,
        word_difficulty: str = "popular",
        n_impostors_override: int | None = None,
        lang: str = "es",
        user_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> StartGameResponse:
        category = random.choice(categories)
        word = await self._llm.pick_word(category, word_difficulty=word_difficulty)

        assignments = await assign_roles(
            players=players, mode=mode, category=category, word=word,
            difficulty=difficulty.value, llm=self._llm,
            n_impostors_override=n_impostors_override,
        )

        n_impostors = sum(1 for a in assignments if a.is_impostor)
        sent, failed = [], []

        for assignment in assignments:
            msg = _build_message(assignment, mode, category, n_impostors, lang)
            ok = await self._messaging.send(assignment.player.telegram_id, msg)
            (sent if ok else failed).append(assignment.player.name)

        if user_id and db:
            round_ = GameRound(
                id=_new_uuid(),
                user_id=user_id,
                mode=mode.value,
                difficulty=difficulty.value,
                word_difficulty=word_difficulty,
                category=category,
                n_impostors=n_impostors,
                sent=json.dumps(sent),
                failed=json.dumps(failed),
            )
            db.add(round_)
            await db.commit()

        return StartGameResponse(
            category=category,
            mode=mode,
            n_impostors=n_impostors,
            sent=sent,
            failed=failed,
        )
```

- [ ] **Step 3: Update app/routes/game.py to extract user_id and pass db**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import StartGameRequest, StartGameResponse
from app.config import DEFAULT_CATEGORIES
from app.game.engine import GameEngine
from app.providers.llm import get_provider as get_llm
from app.providers.messaging import get_provider as get_messaging
from app.auth import get_current_user_optional
from app.db import get_db

router = APIRouter()


@router.post("/game/start", response_model=StartGameResponse)
async def start_game(
    req: StartGameRequest,
    user_id: str | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    categories = req.categories or DEFAULT_CATEGORIES
    engine = GameEngine(llm=get_llm(), messaging=get_messaging())
    return await engine.run(
        players=req.players,
        categories=categories,
        mode=req.mode,
        difficulty=req.difficulty,
        word_difficulty=req.word_difficulty.value,
        n_impostors_override=req.n_impostors,
        lang=req.lang,
        user_id=user_id,
        db=db,
    )
```

- [ ] **Step 4: Create app/routes/history.py**

```python
import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime
from app.db import get_db
from app.models_db import GameRound
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["history"])


class RoundOut(BaseModel):
    id: str
    mode: str
    difficulty: str
    word_difficulty: str
    category: str
    n_impostors: int
    sent: list[str]
    failed: list[str]
    played_at: datetime


class HistoryResponse(BaseModel):
    rounds: list[RoundOut]
    total: int
    page: int
    per_page: int


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * per_page
    count_result = await db.execute(
        select(func.count()).select_from(GameRound).where(GameRound.user_id == user_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(GameRound)
        .where(GameRound.user_id == user_id)
        .order_by(GameRound.played_at.desc())
        .limit(per_page)
        .offset(offset)
    )
    rounds = [
        RoundOut(
            id=r.id,
            mode=r.mode,
            difficulty=r.difficulty,
            word_difficulty=r.word_difficulty,
            category=r.category,
            n_impostors=r.n_impostors,
            sent=json.loads(r.sent),
            failed=json.loads(r.failed),
            played_at=r.played_at,
        )
        for r in result.scalars()
    ]
    return HistoryResponse(rounds=rounds, total=total, page=page, per_page=per_page)
```

- [ ] **Step 5: Register history router in app/main.py**

```python
from app.routes.history import router as history_router
app.include_router(history_router)
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_history.py -v
```

Expected: `4 passed`

- [ ] **Step 7: Run full suite**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add app/game/engine.py app/routes/game.py app/routes/history.py app/main.py tests/test_history.py
git commit -m "feat: game history saved for auth'd users + /users/history endpoint"
```

---

## Task 3: Frontend — HistoryEntry type + useHistory hook

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/history.ts`
- Create: `src/hooks/useHistory.ts`
- Create: `src/hooks/__tests__/useHistory.test.tsx`

- [ ] **Step 1: Add HistoryEntry to src/types/index.ts**

```typescript
export interface HistoryEntry {
  id: string
  mode: string
  difficulty: string
  word_difficulty: string
  category: string
  n_impostors: number
  sent: string[]
  failed: string[]
  played_at: string  // ISO string
}
```

- [ ] **Step 2: Create src/api/history.ts**

```typescript
import type { HistoryEntry } from "../types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface HistoryResponse {
  rounds: HistoryEntry[]
  total: number
  page: number
  per_page: number
}

export async function getHistory(
  token: string,
  page = 1,
  perPage = 20
): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_URL}/users/history?page=${page}&per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error("Failed to load history")
  return res.json()
}
```

- [ ] **Step 3: Write failing tests**

Create `src/hooks/__tests__/useHistory.test.tsx`:

```tsx
import { renderHook, act, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { AuthContext } from "../../contexts/AuthContext"
import { useHistory } from "../useHistory"
import * as historyApi from "../../api/history"
import type { ReactNode } from "react"
import type { GameResult } from "../../types"

const mockToken = "jwt"
const mockUser = { id: "u1", email: "a@b.com", name: "Alice", lang: "es" }

function wrap(user: typeof mockUser | null, token: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ user, token, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      {children}
    </AuthContext.Provider>
  )
}

const mockResult: GameResult = {
  category: "animal",
  mode: "clasico",
  n_impostors: 1,
  sent: ["Marco"],
  failed: [],
}

describe("useHistory — anonymous", () => {
  beforeEach(() => localStorage.clear())

  it("starts empty", () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrap(null, null) })
    expect(result.current.entries).toEqual([])
  })

  it("addRound stores to localStorage, capped at 20", async () => {
    const { result } = renderHook(() => useHistory(), { wrapper: wrap(null, null) })
    for (let i = 0; i < 22; i++) {
      await act(async () => result.current.addRound({ ...mockResult, category: `cat-${i}` }))
    }
    expect(result.current.entries.length).toBe(20)
    expect(result.current.entries[0].category).toBe("cat-21") // newest first
  })
})

describe("useHistory — authenticated", () => {
  it("loads from API", async () => {
    vi.spyOn(historyApi, "getHistory").mockResolvedValue({
      rounds: [{ id: "r1", mode: "clasico", difficulty: "dificil", word_difficulty: "popular",
                 category: "país", n_impostors: 1, sent: ["A"], failed: [], played_at: new Date().toISOString() }],
      total: 1, page: 1, per_page: 20,
    })
    const { result } = renderHook(() => useHistory(), { wrapper: wrap(mockUser, mockToken) })
    await waitFor(() => expect(result.current.entries).toHaveLength(1))
    expect(result.current.entries[0].category).toBe("país")
  })
})
```

- [ ] **Step 4: Run — expect failure**

```bash
npm run test -- --run src/hooks/__tests__/useHistory.test.tsx
```

Expected: `Cannot find module '../useHistory'`

- [ ] **Step 5: Create src/hooks/useHistory.ts**

```typescript
import { useState, useEffect } from "react"
import type { HistoryEntry, GameResult } from "../types"
import { useAuth } from "../contexts/AuthContext"
import { getHistory } from "../api/history"

const LS_KEY = "impostor_history"
const MAX_LOCAL = 20

function loadLocal(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")
  } catch {
    return []
  }
}

function gameResultToEntry(result: GameResult): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    mode: result.mode,
    difficulty: "dificil",
    word_difficulty: "popular",
    category: result.category,
    n_impostors: result.n_impostors,
    sent: result.sent,
    failed: result.failed,
    played_at: new Date().toISOString(),
  }
}

export function useHistory() {
  const { user, token } = useAuth()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (user && token) {
      getHistory(token)
        .then((data) => { setEntries(data.rounds); setTotal(data.total) })
        .catch(() => {})
    } else {
      const local = loadLocal()
      setEntries(local)
      setTotal(local.length)
    }
  }, [user, token])

  const addRound = (result: GameResult) => {
    if (user) {
      // API already saved it — just re-fetch to update
      if (token) {
        getHistory(token)
          .then((data) => { setEntries(data.rounds); setTotal(data.total) })
          .catch(() => {})
      }
    } else {
      const entry = gameResultToEntry(result)
      const updated = [entry, ...loadLocal()].slice(0, MAX_LOCAL)
      localStorage.setItem(LS_KEY, JSON.stringify(updated))
      setEntries(updated)
      setTotal(updated.length)
    }
  }

  return { entries, total, addRound }
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
npm run test -- --run src/hooks/__tests__/useHistory.test.tsx
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/api/history.ts src/hooks/useHistory.ts src/hooks/__tests__/useHistory.test.tsx
git commit -m "feat: useHistory hook — localStorage (anon) + API (auth'd)"
```

---

## Task 4: Frontend — HistoryDrawer component

**Files:**
- Create: `src/components/HistoryDrawer.tsx`

- [ ] **Step 1: Create src/components/HistoryDrawer.tsx**

```tsx
import type { HistoryEntry } from "../types"
import { useAuth } from "../contexts/AuthContext"

interface HistoryDrawerProps {
  open: boolean
  onClose: () => void
  entries: HistoryEntry[]
  total: number
}

const MODE_LABELS: Record<string, string> = {
  clasico: "Clásico 🎭",
  caos: "Caos 🌀",
  ciego: "Ciego 👁️",
  aliados: "Aliados 🤝",
  espejo: "Espejo 🪞",
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

export default function HistoryDrawer({ open, onClose, entries, total }: HistoryDrawerProps) {
  const { user, login } = useAuth()

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed bottom-0 right-0 sm:top-0 sm:bottom-auto z-50 w-full sm:w-80 bg-[#18181B] border-t sm:border-t-0 sm:border-l border-white/10 transition-transform duration-300 ${
          open ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-x-full"
        } h-[70vh] sm:h-screen flex flex-col`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-bold text-white">Historial</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">×</button>
        </div>

        {!user && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-violet-600/10 border border-violet-600/20 text-sm text-violet-300">
            <p>Mostrando las últimas {entries.length} rondas de este dispositivo.</p>
            <button onClick={login} className="mt-2 text-violet-400 underline text-xs">
              Inicia sesión para ver el historial completo
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entries.length === 0 && (
            <p className="text-white/30 text-sm text-center mt-8">No hay partidas aún</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white capitalize">{entry.category}</span>
                <span className="text-xs text-white/40">{formatDate(entry.played_at)}</span>
              </div>
              <div className="flex gap-2 text-xs text-white/50">
                <span>{MODE_LABELS[entry.mode] ?? entry.mode}</span>
                <span>·</span>
                <span>{entry.n_impostors} impostor{entry.n_impostors !== 1 ? "es" : ""}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-green-400">✅ {entry.sent.length}</span>
                {entry.failed.length > 0 && (
                  <span className="text-red-400">❌ {entry.failed.length}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {user && total > entries.length && (
          <div className="p-4 border-t border-white/10 text-xs text-white/30 text-center">
            Mostrando {entries.length} de {total} rondas
          </div>
        )}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HistoryDrawer.tsx
git commit -m "feat: HistoryDrawer component"
```

---

## Task 5: Frontend — Wire history into GameResult and App

**Files:**
- Modify: `src/components/GameResult.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update GameResult to call addRound**

In `src/components/GameResult.tsx`, accept and call `onRoundComplete`:

```tsx
interface GameResultProps {
  result: GameResult
  onReset: () => void
  onRoundComplete: (result: GameResult) => void
}

export default function GameResult({ result, onReset, onRoundComplete }: GameResultProps) {
  // Call addRound once when this component mounts
  useEffect(() => {
    onRoundComplete(result)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { user, login } = useAuth()

  return (
    <div className="space-y-6">
      {/* existing result UI */}
      
      {!user && (
        <p className="text-center text-xs text-white/40">
          <button onClick={login} className="text-violet-400 underline">Inicia sesión</button>
          {" "}para guardar tu historial en todos tus dispositivos
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update App.tsx — mount HistoryDrawer, wire history**

In `src/App.tsx`, add:

```tsx
import HistoryDrawer from "./components/HistoryDrawer"
import { useHistory } from "./hooks/useHistory"

// Inside App:
const history = useHistory()
const [historyOpen, setHistoryOpen] = useState(false)

// In header, add history icon button before settings:
<button
  onClick={() => setHistoryOpen(true)}
  className="p-2 rounded-full hover:bg-white/10 transition-colors"
  aria-label="Historial"
>
  <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
</button>

// In JSX, add HistoryDrawer:
<HistoryDrawer
  open={historyOpen}
  onClose={() => setHistoryOpen(false)}
  entries={history.entries}
  total={history.total}
/>

// In GameResult usage, add onRoundComplete:
<GameResult
  result={game.result}
  onReset={game.reset}
  onRoundComplete={history.addRound}
/>
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 4: Run all frontend tests**

```bash
npm run test -- --run
```

Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/components/GameResult.tsx src/App.tsx
git commit -m "feat: history wired — HistoryDrawer in App, addRound after each game"
```

---

## Task 6: Push and verify CI

- [ ] **Run backend full suite**

```bash
cd impostor-api && pytest tests/ -v && ruff check .
```

Expected: all pass

- [ ] **Run frontend full suite**

```bash
cd impostor-web && npm run test -- --run && npm run build
```

Expected: all pass

- [ ] **Push both**

```bash
cd impostor-api && git push
cd impostor-web && git push
```
