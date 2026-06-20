# Gameplay Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add word difficulty (popular vs. obscure), per-round category selection with custom category validation via LLM, and impostor count override for classic mode — to both backend and frontend.

**Architecture:** Backend gains a `WordDifficulty` enum in `StartGameRequest`, updated `pick_word` prompts, a `validate_category` LLM method + endpoint, and a `SavedCategory` DB model. Frontend gains `CategorySelector` and `ImpostorCountSlider` components, and a `useCategories` hook. Auth is optional — saved categories require login.

**Tech Stack:** Existing stack. `SavedCategory` table in SQLAlchemy (requires Plan 1). No new deps.

**Prerequisite:** Plan 1 (Foundation) must be complete — needs `app/db.py`, `app/models_db.py`, `app/auth.py`.

---

## File Map

### impostor-api

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/models.py` | Add `WordDifficulty` enum |
| Modify | `app/providers/llm/openrouter.py` | `pick_word` accepts `word_difficulty`, add `validate_category` |
| Modify | `app/providers/llm/__init__.py` | Add `validate_category` to `LLMProvider` Protocol |
| Modify | `app/game/engine.py` | Pass `word_difficulty` to `pick_word`, `n_impostors` override |
| Modify | `app/game/roles.py` | Accept optional `n_impostors` override |
| Create | `app/routes/categories.py` | GET /api/categories, POST /api/categories/validate |
| Modify | `app/routes/game.py` | Use new request fields |
| Create | `app/models_db.py` addition | `SavedCategory` model |
| Create | `app/routes/users_categories.py` | GET/POST/DELETE /users/categories |
| Modify | `app/main.py` | Include new routers |
| Create | `tests/test_categories.py` | validate_category tests |
| Create | `tests/test_gameplay.py` | word_difficulty and n_impostors tests |

### impostor-web

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add `WordDifficulty` type |
| Modify | `src/api/game.ts` | Add `word_difficulty`, `n_impostors`, `lang` to request |
| Create | `src/api/categories.ts` | `validateCategory`, `getUserCategories`, CRUD |
| Create | `src/hooks/useCategories.ts` | Category list + validate + saved categories |
| Create | `src/components/CategorySelector.tsx` | Aleatoria toggle + category chips + propose input |
| Create | `src/components/ImpostorCountSlider.tsx` | Slider for clasico mode |
| Modify | `src/App.tsx` | Add CategorySelector + ImpostorCountSlider, pass to startGame |
| Create | `src/components/__tests__/CategorySelector.test.tsx` | Validation flow tests |

---

## Task 1: Backend — WordDifficulty enum + pick_word update

**Files:**
- Modify: `app/models.py`
- Modify: `app/providers/llm/openrouter.py`
- Modify: `app/providers/llm/__init__.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_gameplay.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch
from app.models import WordDifficulty


def test_word_difficulty_enum():
    assert WordDifficulty.popular.value == "popular"
    assert WordDifficulty.obscuro.value == "obscuro"


async def test_pick_word_popular_uses_famous_prompt():
    from app.providers.llm.openrouter import OpenRouterProvider
    provider = OpenRouterProvider()
    captured = {}

    async def fake_create(**kwargs):
        captured["messages"] = kwargs.get("messages", [])
        mock = AsyncMock()
        mock.choices = [AsyncMock()]
        mock.choices[0].message.content = "perro"
        return mock

    with patch.object(provider._client.chat.completions, "create", side_effect=fake_create):
        result = await provider.pick_word("animal", word_difficulty="popular")

    assert result == "perro"
    system_msg = captured["messages"][0]["content"]
    assert "famous" in system_msg or "conocid" in system_msg or "popular" in system_msg.lower()


async def test_pick_word_obscuro_uses_niche_prompt():
    from app.providers.llm.openrouter import OpenRouterProvider
    provider = OpenRouterProvider()
    captured = {}

    async def fake_create(**kwargs):
        captured["messages"] = kwargs.get("messages", [])
        mock = AsyncMock()
        mock.choices = [AsyncMock()]
        mock.choices[0].message.content = "Millonarios"
        return mock

    with patch.object(provider._client.chat.completions, "create", side_effect=fake_create):
        result = await provider.pick_word("jugador de fútbol famoso", word_difficulty="obscuro")

    assert result == "Millonarios"
    system_msg = captured["messages"][0]["content"]
    assert "obscure" in system_msg or "niche" in system_msg or "desconoc" in system_msg.lower()
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_gameplay.py::test_word_difficulty_enum -v
```

Expected: `ImportError: cannot import name 'WordDifficulty'`

- [ ] **Step 3: Add WordDifficulty to app/models.py**

Add after the existing `Difficulty` enum:

```python
class WordDifficulty(str, Enum):
    popular = "popular"   # famous, universally known examples
    obscuro = "obscuro"   # niche, uncommon examples most people wouldn't recognize
```

Also add to `StartGameRequest`:

```python
from app.models import Mode, Difficulty, WordDifficulty, Player

class StartGameRequest(BaseModel):
    players: list[Player]
    mode: Mode = Mode.caos
    difficulty: Difficulty = Difficulty.dificil
    word_difficulty: WordDifficulty = WordDifficulty.popular  # NEW
    categories: list[str] | None = None
    lang: str = "es"  # NEW
    n_impostors: int | None = None  # NEW — override for clasico mode
```

- [ ] **Step 4: Update pick_word in app/providers/llm/openrouter.py**

Replace the existing `pick_word` method:

```python
_WORD_PROMPTS = {
    "popular": (
        "You are a word selector for a party game. "
        "Give me one very famous, universally known example of the category. "
        "One word or short name only. No explanation."
    ),
    "obscuro": (
        "You are a word selector for a party game. "
        "Give me one very obscure, niche, or uncommon example of the category "
        "that most people would NOT recognize. "
        "One word or short name only. No explanation."
    ),
}

async def pick_word(self, category: str, word_difficulty: str = "popular") -> str:
    system = _WORD_PROMPTS.get(word_difficulty, _WORD_PROMPTS["popular"])
    resp = await self._client.chat.completions.create(
        model=self._model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"Category: {category}"},
        ],
        max_tokens=10,
        temperature=0.9,
    )
    return resp.choices[0].message.content.strip()
```

- [ ] **Step 5: Update LLMProvider Protocol in app/providers/llm/__init__.py**

```python
from typing import Protocol

class LLMProvider(Protocol):
    async def pick_word(self, category: str, word_difficulty: str = "popular") -> str: ...
    async def pick_hint(self, category: str, word: str, difficulty: str, exclude: list[str]) -> str: ...
    async def pick_mirror_word(self, category: str, exclude: list[str]) -> str: ...
    async def validate_category(self, name: str) -> bool: ...
```

- [ ] **Step 6: Run tests — expect pass**

```bash
pytest tests/test_gameplay.py -v
```

Expected: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add app/models.py app/providers/llm/openrouter.py app/providers/llm/__init__.py tests/test_gameplay.py
git commit -m "feat: WordDifficulty enum + pick_word popular/obscuro prompts"
```

---

## Task 2: Backend — validate_category LLM method + endpoint

**Files:**
- Modify: `app/providers/llm/openrouter.py`
- Create: `app/routes/categories.py`
- Modify: `app/main.py`
- Create: `tests/test_categories.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_categories.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch


async def test_validate_category_yes(client, mock_llm):
    from app.providers.llm import get_provider
    with patch("app.routes.categories.get_llm", return_value=mock_llm):
        mock_llm.validate_category.return_value = True
        resp = await client.post("/api/categories/validate", json={"name": "animal"})
    assert resp.status_code == 200
    assert resp.json()["valid"] is True


async def test_validate_category_no(client, mock_llm):
    with patch("app.routes.categories.get_llm", return_value=mock_llm):
        mock_llm.validate_category.return_value = False
        resp = await client.post("/api/categories/validate", json={"name": "asdfqwerty123"})
    assert resp.status_code == 200
    assert resp.json()["valid"] is False


async def test_validate_category_too_long_rejected_without_llm(client, mock_llm):
    with patch("app.routes.categories.get_llm", return_value=mock_llm):
        name = "a" * 101
        resp = await client.post("/api/categories/validate", json={"name": name})
    assert resp.status_code == 200
    assert resp.json()["valid"] is False
    mock_llm.validate_category.assert_not_called()


async def test_get_categories(client):
    resp = await client.get("/api/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert "default" in data
    assert isinstance(data["default"], list)
    assert len(data["default"]) > 0
```

- [ ] **Step 2: Add validate_category to openrouter.py**

Add to `OpenRouterProvider` class (after `pick_mirror_word`):

```python
_category_cache: dict[str, bool] = {}

async def validate_category(self, name: str) -> bool:
    name_lower = name.lower().strip()
    if name_lower in self._category_cache:
        return self._category_cache[name_lower]

    resp = await self._client.chat.completions.create(
        model=self._model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a party game category validator. "
                    "Answer only YES or NO. "
                    "A valid category must be concrete, have many possible members, "
                    "and be appropriate for all ages."
                ),
            },
            {"role": "user", "content": f"Is '{name}' a valid category for a word-guessing party game?"},
        ],
        max_tokens=5,
        temperature=0.0,
    )
    text = resp.choices[0].message.content.strip().upper()
    result = text.startswith("YES")
    self._category_cache[name_lower] = result
    return result
```

Note: add `_category_cache: dict[str, bool] = {}` as a class-level attribute in `OpenRouterProvider`.

- [ ] **Step 3: Create app/routes/categories.py**

```python
from fastapi import APIRouter
from pydantic import BaseModel
from app.config import DEFAULT_CATEGORIES
from app.providers.llm import get_provider as get_llm

router = APIRouter(prefix="/api", tags=["categories"])


class ValidateCategoryRequest(BaseModel):
    name: str


class ValidateCategoryResponse(BaseModel):
    valid: bool
    name: str


@router.get("/categories")
async def get_categories():
    return {"default": DEFAULT_CATEGORIES}


@router.post("/categories/validate", response_model=ValidateCategoryResponse)
async def validate_category(req: ValidateCategoryRequest):
    name = req.name.strip()
    if len(name) > 100 or len(name) < 2:
        return ValidateCategoryResponse(valid=False, name=name)
    llm = get_llm()
    valid = await llm.validate_category(name)
    return ValidateCategoryResponse(valid=valid, name=name)
```

- [ ] **Step 4: Move GET /categories from game.py to categories.py, update main.py**

In `app/routes/game.py`, remove the `@router.get("/categories")` endpoint (it now lives in `categories.py`).

In `app/main.py`, add:

```python
from app.routes.categories import router as categories_router
# ...
app.include_router(categories_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_categories.py -v
```

Expected: `4 passed`

- [ ] **Step 6: Run full backend tests**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add app/providers/llm/openrouter.py app/routes/categories.py app/routes/game.py app/main.py tests/test_categories.py
git commit -m "feat: validate_category LLM method + /api/categories/validate endpoint"
```

---

## Task 3: Backend — SavedCategory model + users categories endpoints

**Files:**
- Modify: `app/models_db.py`
- Create: `app/routes/users_categories.py`
- Modify: `app/main.py`
- Modify: `app/routes/categories.py`
- Create migration

- [ ] **Step 1: Add SavedCategory to app/models_db.py**

```python
from sqlalchemy import String, BigInteger, ForeignKey, DateTime, UniqueConstraint
# Add after Player class:

class SavedCategory(Base):
    __tablename__ = "saved_categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_category"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="saved_categories")
```

Add `saved_categories` relationship to `User`:
```python
saved_categories: Mapped[list["SavedCategory"]] = relationship(
    "SavedCategory", back_populates="user", cascade="all, delete-orphan"
)
```

- [ ] **Step 2: Generate migration**

```bash
alembic revision --autogenerate -m "add_saved_categories"
alembic upgrade head
```

Expected: migration creates `saved_categories` table.

- [ ] **Step 3: Create app/routes/users_categories.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db import get_db, _new_uuid
from app.models_db import SavedCategory
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class CategoryOut(BaseModel):
    id: str
    name: str


@router.get("/categories", response_model=list[CategoryOut])
async def list_saved(user_id: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedCategory).where(SavedCategory.user_id == user_id))
    return [CategoryOut(id=c.id, name=c.name) for c in result.scalars()]


@router.post("/categories", response_model=CategoryOut, status_code=201)
async def save_category(
    body: BaseModel,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # body validation inline
    from pydantic import BaseModel as PBM
    class _Body(PBM):
        name: str
    parsed = _Body.model_validate(body if isinstance(body, dict) else body.__dict__)
    existing = await db.execute(
        select(SavedCategory).where(
            SavedCategory.user_id == user_id, SavedCategory.name == parsed.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category already saved")
    cat = SavedCategory(id=_new_uuid(), user_id=user_id, name=parsed.name)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut(id=cat.id, name=cat.name)


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(
    cat_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedCategory).where(SavedCategory.id == cat_id, SavedCategory.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
```

Actually, there's a Pydantic issue with the inline body class. Rewrite `save_category` properly:

```python
class SaveBody(BaseModel):
    name: str

@router.post("/categories", response_model=CategoryOut, status_code=201)
async def save_category(
    body: SaveBody,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(SavedCategory).where(
            SavedCategory.user_id == user_id, SavedCategory.name == body.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category already saved")
    cat = SavedCategory(id=_new_uuid(), user_id=user_id, name=body.name)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryOut(id=cat.id, name=cat.name)
```

- [ ] **Step 4: Update GET /api/categories to include saved categories when auth'd**

In `app/routes/categories.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.config import DEFAULT_CATEGORIES
from app.providers.llm import get_provider as get_llm
from app.db import get_db
from app.models_db import SavedCategory
from app.auth import get_current_user_optional

router = APIRouter(prefix="/api", tags=["categories"])


class ValidateCategoryRequest(BaseModel):
    name: str


class ValidateCategoryResponse(BaseModel):
    valid: bool
    name: str


@router.get("/categories")
async def get_categories(
    user_id: str | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    saved: list[str] = []
    if user_id:
        result = await db.execute(select(SavedCategory).where(SavedCategory.user_id == user_id))
        saved = [c.name for c in result.scalars()]
    return {"default": DEFAULT_CATEGORIES, "saved": saved}


@router.post("/categories/validate", response_model=ValidateCategoryResponse)
async def validate_category(req: ValidateCategoryRequest):
    name = req.name.strip()
    if len(name) > 100 or len(name) < 2:
        return ValidateCategoryResponse(valid=False, name=name)
    llm = get_llm()
    valid = await llm.validate_category(name)
    return ValidateCategoryResponse(valid=valid, name=name)
```

- [ ] **Step 5: Register users_categories router in main.py**

```python
from app.routes.users_categories import router as users_categories_router
app.include_router(users_categories_router)
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add app/models_db.py app/routes/users_categories.py app/routes/categories.py app/main.py alembic/
git commit -m "feat: SavedCategory model + /users/categories CRUD endpoints"
```

---

## Task 4: Backend — n_impostors override and word_difficulty in engine

**Files:**
- Modify: `app/game/roles.py`
- Modify: `app/game/engine.py`
- Modify: `app/routes/game.py`

- [ ] **Step 1: Add test for n_impostors override**

In `tests/test_gameplay.py`, add:

```python
async def test_start_game_with_n_impostors_override(client, mock_llm, mock_messaging):
    from app.providers.llm import get_provider as get_llm_p
    from app.providers.messaging import get_provider as get_msg_p
    with patch("app.routes.game.get_llm", return_value=mock_llm), \
         patch("app.routes.game.get_messaging", return_value=mock_messaging):
        resp = await client.post("/api/game/start", json={
            "players": [
                {"name": "A", "telegram_id": 1},
                {"name": "B", "telegram_id": 2},
                {"name": "C", "telegram_id": 3},
                {"name": "D", "telegram_id": 4},
            ],
            "mode": "clasico",
            "difficulty": "facil",
            "word_difficulty": "popular",
            "n_impostors": 2,
        })
    assert resp.status_code == 200
    assert resp.json()["n_impostors"] == 2


async def test_start_game_word_difficulty_passed(client, mock_llm, mock_messaging):
    with patch("app.routes.game.get_llm", return_value=mock_llm), \
         patch("app.routes.game.get_messaging", return_value=mock_messaging):
        resp = await client.post("/api/game/start", json={
            "players": [
                {"name": "A", "telegram_id": 1},
                {"name": "B", "telegram_id": 2},
            ],
            "mode": "clasico",
            "difficulty": "dificil",
            "word_difficulty": "obscuro",
        })
    assert resp.status_code == 200
    mock_llm.pick_word.assert_called_once()
    call_kwargs = mock_llm.pick_word.call_args
    assert "obscuro" in str(call_kwargs)
```

- [ ] **Step 2: Update app/game/roles.py — accept n_impostors override**

In `assign_roles()`, add `n_impostors_override: int | None = None` parameter. When mode is `clasico` and override is provided:

```python
async def assign_roles(
    players: list,
    mode,
    category: str,
    word: str,
    difficulty: str,
    llm,
    n_impostors_override: int | None = None,
) -> list:
    n = len(players)

    if mode == Mode.clasico:
        n_impostors = n_impostors_override if n_impostors_override is not None else 1
        n_impostors = max(1, min(n_impostors, n // 2))  # clamp to valid range
    elif mode == Mode.aliados:
        n_impostors = 2
    elif mode == Mode.espejo:
        n_impostors = random.randint(1, max(1, n // 2))
    else:  # caos, ciego
        n_impostors = random.randint(0, n)

    # rest of existing logic unchanged
```

- [ ] **Step 3: Update app/game/engine.py — pass word_difficulty and n_impostors_override**

```python
async def run(
    self,
    players: list[Player],
    categories: list[str],
    mode: Mode = Mode.caos,
    difficulty: Difficulty = Difficulty.dificil,
    word_difficulty: str = "popular",
    n_impostors_override: int | None = None,
    lang: str = "es",
) -> StartGameResponse:
    category = random.choice(categories)
    word = await self._llm.pick_word(category, word_difficulty=word_difficulty)

    assignments = await assign_roles(
        players=players,
        mode=mode,
        category=category,
        word=word,
        difficulty=difficulty.value,
        llm=self._llm,
        n_impostors_override=n_impostors_override,
    )
    # rest unchanged
```

- [ ] **Step 4: Update app/routes/game.py — pass new fields**

```python
@router.post("/game/start", response_model=StartGameResponse)
async def start_game(req: StartGameRequest):
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
    )
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_gameplay.py -v
```

Expected: `5 passed`

- [ ] **Step 6: Run full suite**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add app/game/roles.py app/game/engine.py app/routes/game.py tests/test_gameplay.py
git commit -m "feat: n_impostors override + word_difficulty passed through game engine"
```

---

## Task 5: Frontend — useCategories hook

**Files:**
- Create: `src/api/categories.ts`
- Create: `src/hooks/useCategories.ts`

- [ ] **Step 1: Create src/api/categories.ts**

```typescript
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface CategoriesResponse {
  default: string[]
  saved: string[]
}

export async function getCategories(token?: string | null): Promise<CategoriesResponse> {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_URL}/api/categories`, { headers })
  if (!res.ok) throw new Error("Failed to load categories")
  return res.json()
}

export async function validateCategory(name: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/categories/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) return false
  const data = await res.json()
  return data.valid
}

export async function saveCategory(token: string, name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${API_URL}/users/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to save category")
  return res.json()
}

export async function deleteSavedCategory(token: string, id: string): Promise<void> {
  await fetch(`${API_URL}/users/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
}
```

- [ ] **Step 2: Create src/hooks/useCategories.ts**

```typescript
import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { getCategories, validateCategory as apiValidate } from "../api/categories"

export interface CategoryState {
  defaultCategories: string[]
  savedCategories: string[]
  selected: string | null   // null = random
  customInput: string
  validating: boolean
  validationError: string | null
}

export function useCategories() {
  const { token } = useAuth()
  const [defaultCategories, setDefaultCategories] = useState<string[]>([])
  const [savedCategories, setSavedCategories] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [customInput, setCustomInput] = useState("")
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    getCategories(token)
      .then((data) => {
        setDefaultCategories(data.default)
        setSavedCategories(data.saved ?? [])
      })
      .catch(() => {})
  }, [token])

  const selectCategory = (name: string | null) => {
    setSelected(name)
    setCustomInput("")
    setValidationError(null)
  }

  const validateAndSelect = async (name: string): Promise<boolean> => {
    if (!name.trim()) return false
    setValidating(true)
    setValidationError(null)
    try {
      const valid = await apiValidate(name.trim())
      if (valid) {
        setSelected(name.trim())
        setCustomInput("")
      } else {
        setValidationError("Esa categoría no es válida para el juego. Prueba otra.")
      }
      return valid
    } catch {
      setValidationError("Error al validar la categoría.")
      return false
    } finally {
      setValidating(false)
    }
  }

  // Returns the categories list to send to the API
  // null = random (let backend pick from defaults)
  const getSelectedList = (): string[] | null => {
    if (!selected) return null
    return [selected]
  }

  return {
    defaultCategories,
    savedCategories,
    selected,
    customInput,
    setCustomInput,
    validating,
    validationError,
    selectCategory,
    validateAndSelect,
    getSelectedList,
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/api/categories.ts src/hooks/useCategories.ts
git commit -m "feat: useCategories hook with validation"
```

---

## Task 6: Frontend — CategorySelector component

**Files:**
- Create: `src/components/CategorySelector.tsx`
- Create: `src/components/__tests__/CategorySelector.test.tsx`

- [ ] **Step 1: Write tests**

Create `src/components/__tests__/CategorySelector.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import CategorySelector from "../CategorySelector"
import * as categoriesApi from "../../api/categories"

const noop = () => {}
const defaultProps = {
  defaultCategories: ["animal", "país", "fruta"],
  savedCategories: [],
  selected: null as string | null,
  customInput: "",
  setCustomInput: noop,
  validating: false,
  validationError: null as string | null,
  selectCategory: noop,
  validateAndSelect: vi.fn(),
  getSelectedList: () => null,
}

describe("CategorySelector", () => {
  it("shows 'Aleatoria' as default state", () => {
    render(<CategorySelector {...defaultProps} />)
    expect(screen.getByText(/aleatoria/i)).toBeInTheDocument()
  })

  it("shows category chips when a category is clicked", () => {
    render(<CategorySelector {...defaultProps} />)
    expect(screen.getByText("animal")).toBeInTheDocument()
  })

  it("highlights selected category", () => {
    render(<CategorySelector {...defaultProps} selected="animal" />)
    const chip = screen.getByText("animal").closest("button")
    expect(chip?.className).toContain("bg-violet")
  })

  it("calls validateAndSelect on propose submit", async () => {
    const validateAndSelect = vi.fn().mockResolvedValue(true)
    render(
      <CategorySelector
        {...defaultProps}
        customInput="videojuegos"
        setCustomInput={noop}
        validateAndSelect={validateAndSelect}
      />
    )
    const btn = screen.getByRole("button", { name: /validar/i })
    fireEvent.click(btn)
    await waitFor(() => expect(validateAndSelect).toHaveBeenCalledWith("videojuegos"))
  })

  it("shows validation error", () => {
    render(<CategorySelector {...defaultProps} validationError="Categoría inválida" />)
    expect(screen.getByText("Categoría inválida")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm run test -- --run src/components/__tests__/CategorySelector.test.tsx
```

Expected: `Cannot find module '../CategorySelector'`

- [ ] **Step 3: Create src/components/CategorySelector.tsx**

```tsx
interface CategorySelectorProps {
  defaultCategories: string[]
  savedCategories: string[]
  selected: string | null
  customInput: string
  setCustomInput: (v: string) => void
  validating: boolean
  validationError: string | null
  selectCategory: (name: string | null) => void
  validateAndSelect: (name: string) => Promise<boolean>
  getSelectedList: () => string[] | null
}

export default function CategorySelector({
  defaultCategories,
  savedCategories,
  selected,
  customInput,
  setCustomInput,
  validating,
  validationError,
  selectCategory,
  validateAndSelect,
}: CategorySelectorProps) {
  const allCategories = [...defaultCategories, ...savedCategories]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70 uppercase tracking-wide">Categoría</span>
        <button
          onClick={() => selectCategory(null)}
          className={`text-xs px-2 py-1 rounded-full transition-colors ${
            selected === null
              ? "bg-violet-600 text-white"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          Aleatoria
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              selected === cat
                ? "bg-violet-600 border-violet-600 text-white"
                : "border-white/20 text-white/60 hover:border-white/40 hover:text-white/90"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && customInput.trim() && validateAndSelect(customInput)}
          placeholder="Proponer categoría..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500"
        />
        <button
          onClick={() => customInput.trim() && validateAndSelect(customInput)}
          disabled={!customInput.trim() || validating}
          className="px-3 py-2 rounded-lg bg-violet-600 text-sm text-white disabled:opacity-40 hover:bg-violet-500 transition-colors"
        >
          {validating ? "..." : "Validar"}
        </button>
      </div>

      {validationError && (
        <p className="text-xs text-red-400">{validationError}</p>
      )}

      {selected && (
        <p className="text-xs text-violet-400">
          Categoría seleccionada: <span className="font-semibold">{selected}</span>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test -- --run src/components/__tests__/CategorySelector.test.tsx
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/CategorySelector.tsx src/components/__tests__/CategorySelector.test.tsx
git commit -m "feat: CategorySelector component with validation"
```

---

## Task 7: Frontend — ImpostorCountSlider + wire everything to App

**Files:**
- Create: `src/components/ImpostorCountSlider.tsx`
- Modify: `src/App.tsx`
- Modify: `src/types/index.ts`
- Modify: `src/api/game.ts`

- [ ] **Step 1: Add WordDifficulty to src/types/index.ts**

```typescript
export type WordDifficulty = "popular" | "obscuro"
```

- [ ] **Step 2: Create src/components/ImpostorCountSlider.tsx**

```tsx
interface ImpostorCountSliderProps {
  count: number
  max: number
  onChange: (n: number) => void
}

export default function ImpostorCountSlider({ count, max, onChange }: ImpostorCountSliderProps) {
  if (max < 1) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70 uppercase tracking-wide">
          N° de impostores
        </span>
        <span className="text-sm font-bold text-violet-400">{count}</span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={count}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-600"
      />
      <div className="flex justify-between text-xs text-white/30">
        <span>1</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update src/api/game.ts to include new fields**

```typescript
import type { Mode, Difficulty, Player, GameResult, WordDifficulty } from "../types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface StartGameRequest {
  players: Player[]
  mode: Mode
  difficulty: Difficulty
  word_difficulty: WordDifficulty
  categories?: string[]
  n_impostors?: number
  lang?: string
}

export async function startGame(req: StartGameRequest): Promise<GameResult> {
  const res = await fetch(`${API_URL}/api/game/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? "Error al iniciar la partida")
  }
  return res.json()
}

export async function getCategories(): Promise<{ default: string[]; saved: string[] }> {
  const res = await fetch(`${API_URL}/api/categories`)
  if (!res.ok) throw new Error("Error al obtener categorías")
  return res.json()
}
```

- [ ] **Step 4: Wire CategorySelector, ImpostorCountSlider, and new fields into App.tsx**

In `src/App.tsx`, add state and imports:

```tsx
import { useState } from "react"
import CategorySelector from "./components/CategorySelector"
import ImpostorCountSlider from "./components/ImpostorCountSlider"
import { useCategories } from "./hooks/useCategories"
import type { WordDifficulty } from "./types"

// Inside App component, add:
const categories = useCategories()
const [wordDifficulty, setWordDifficulty] = useState<WordDifficulty>("popular")
const [nImpostors, setNImpostors] = useState(1)

// In the game start handler, pass new fields:
const handleStart = async () => {
  await game.start({
    players,
    mode,
    difficulty,
    word_difficulty: wordDifficulty,
    categories: categories.getSelectedList() ?? undefined,
    n_impostors: mode === "clasico" ? nImpostors : undefined,
  })
}
```

Add `CategorySelector` and `ImpostorCountSlider` to the main form JSX:

```tsx
<CategorySelector
  defaultCategories={categories.defaultCategories}
  savedCategories={categories.savedCategories}
  selected={categories.selected}
  customInput={categories.customInput}
  setCustomInput={categories.setCustomInput}
  validating={categories.validating}
  validationError={categories.validationError}
  selectCategory={categories.selectCategory}
  validateAndSelect={categories.validateAndSelect}
  getSelectedList={categories.getSelectedList}
/>

{/* WordDifficulty toggle — below DifficultyToggle */}
<div className="flex gap-2">
  <span className="text-sm text-white/50 mr-2">Palabras:</span>
  {(["popular", "obscuro"] as WordDifficulty[]).map((d) => (
    <button
      key={d}
      onClick={() => setWordDifficulty(d)}
      className={`text-sm px-3 py-1 rounded-full border transition-colors ${
        wordDifficulty === d
          ? "bg-violet-600 border-violet-600 text-white"
          : "border-white/20 text-white/50 hover:text-white/80"
      }`}
    >
      {d === "popular" ? "Populares" : "Oscuras"}
    </button>
  ))}
</div>

{mode === "clasico" && (
  <ImpostorCountSlider
    count={nImpostors}
    max={Math.max(1, Math.floor(players.length / 2))}
    onChange={setNImpostors}
  />
)}
```

- [ ] **Step 5: Build to verify no type errors**

```bash
npm run build
```

Expected: builds with no TypeScript errors

- [ ] **Step 6: Run all frontend tests**

```bash
npm run test -- --run
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/api/game.ts src/components/ImpostorCountSlider.tsx src/App.tsx src/hooks/useCategories.ts
git commit -m "feat: CategorySelector + ImpostorCountSlider wired to App"
```

---

## Task 8: Final check — run everything

- [ ] **Run backend full suite**

```bash
cd impostor-api && pytest tests/ -v && ruff check .
```

Expected: all pass, no lint errors

- [ ] **Run frontend full suite**

```bash
cd impostor-web && npm run test -- --run && npm run build
```

Expected: all pass, build succeeds

- [ ] **Push both repos**

```bash
cd impostor-api && git push
cd impostor-web && git push
```
