# Foundation: DB + Auth + Player Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SQLite (Postgres-ready) database, Google OAuth with JWT, and synced player storage to both `impostor-api` and `impostor-web`. The game continues to work without an account.

**Architecture:** FastAPI backend gains SQLAlchemy async models + Alembic migrations + an auth layer (Google OAuth code exchange → own JWT). Frontend gains an `AuthContext` that gates player sync: unauthenticated users keep localStorage, authenticated users read/write `/users/players`.

**Tech Stack:** SQLAlchemy 2 async + aiosqlite (dev) / asyncpg (prod) · Alembic · python-jose · authlib → httpx for Google exchange · React Context · Google Identity Services (GSI) popup

---

## File Map

### impostor-api

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/db.py` | Engine, session factory, Base, `_new_uuid()` |
| Create | `app/models_db.py` | ORM: User, Player |
| Create | `alembic.ini` + `alembic/env.py` + `alembic/versions/` | Migrations |
| Create | `app/auth.py` | JWT encode/decode, Google exchange, FastAPI dependencies |
| Create | `app/routes/auth.py` | POST /auth/google, GET /auth/me, DELETE /auth/me |
| Create | `app/routes/users.py` | GET/POST/DELETE /users/players |
| Modify | `app/main.py` | Include new routers, DB lifespan |
| Modify | `app/config.py` | Add JWT_SECRET_KEY, GOOGLE_CLIENT_ID/SECRET, DATABASE_URL |
| Modify | `requirements.txt` | New prod deps |
| Modify | `requirements-dev.txt` | Add respx |
| Modify | `.env.example` | New env vars |
| Modify | `tests/conftest.py` | In-memory SQLite fixture, override get_db |
| Create | `tests/test_auth.py` | Auth endpoint tests |
| Create | `tests/test_users.py` | Player CRUD tests |

### impostor-web

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/types/index.ts` | Add AuthUser type |
| Create | `src/contexts/AuthContext.tsx` | AuthProvider + useAuth hook |
| Create | `src/api/auth.ts` | loginWithGoogle, getMe, authFetch helper |
| Create | `src/api/users.ts` | listPlayers, createPlayer, deletePlayer |
| Modify | `src/hooks/usePlayers.ts` | Switch to API when auth'd, merge on login |
| Create | `src/components/AuthButton.tsx` | Google login button + user chip |
| Modify | `src/main.tsx` | Wrap app in AuthProvider |
| Modify | `src/App.tsx` | Add AuthButton to header |
| Modify | `index.html` | Add GSI script tag |
| Modify | `.env.example` | VITE_GOOGLE_CLIENT_ID |
| Create | `src/contexts/__tests__/AuthContext.test.tsx` | Auth context tests |
| Create | `src/hooks/__tests__/usePlayers.test.tsx` | Player sync tests |
| Modify | `package.json` | Add vitest + testing-library |
| Create | `vitest.config.ts` | Vitest setup |
| Modify | `.github/workflows/ci.yml` | Add `npm run test -- --run` step |

---

## Task 1: Backend — Add new dependencies

**Files:**
- Modify: `requirements.txt`
- Modify: `requirements-dev.txt`
- Modify: `.env.example`
- Modify: `app/config.py`

- [ ] **Step 1: Update requirements.txt**

```text
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
openai>=1.30.0
python-telegram-bot>=21.0
pydantic>=2.7.0
python-dotenv>=1.0.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
alembic>=1.13.0
python-jose[cryptography]>=3.3.0
httpx>=0.27.0
```

- [ ] **Step 2: Update requirements-dev.txt**

```text
-r requirements.txt
pytest>=8.2.0
pytest-asyncio>=0.23.0
ruff>=0.4.0
respx>=0.21.0
```

- [ ] **Step 3: Update .env.example**

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
TELEGRAM_TOKEN=

DATABASE_URL=sqlite+aiosqlite:///./impostor.db
JWT_SECRET_KEY=change-me-run-openssl-rand-hex-32
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

- [ ] **Step 4: Update app/config.py**

```python
import os

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct:free")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./impostor.db")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-change-in-prod")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

DEFAULT_CATEGORIES = [
    "animal", "país", "fruta", "profesión", "marca de ropa",
    "comida colombiana", "ciudad de Colombia", "superhéroe",
    "empresa de tecnología", "marca de carros", "jugador de fútbol famoso",
]
```

- [ ] **Step 5: Install deps**

```bash
pip install -r requirements-dev.txt
```

Expected: installs without errors. `python -c "import sqlalchemy, jose, alembic"` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add requirements.txt requirements-dev.txt .env.example app/config.py
git commit -m "chore: add DB + auth dependencies"
```

---

## Task 2: Backend — Database engine and ORM models

**Files:**
- Create: `app/db.py`
- Create: `app/models_db.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_db.py`:

```python
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db import Base, _new_uuid
from app.models_db import User, Player


@pytest.fixture
async def mem_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


async def test_create_user(mem_engine):
    session_factory = async_sessionmaker(mem_engine, expire_on_commit=False)
    async with session_factory() as s:
        user = User(id=_new_uuid(), google_id="g-1", email="a@b.com", name="Alice")
        s.add(user)
        await s.commit()
        await s.refresh(user)
    assert user.id is not None
    assert user.lang == "es"


async def test_create_player_cascades(mem_engine):
    from sqlalchemy import select
    session_factory = async_sessionmaker(mem_engine, expire_on_commit=False)
    async with session_factory() as s:
        user = User(id=_new_uuid(), google_id="g-2", email="b@b.com", name="Bob")
        s.add(user)
        await s.commit()
        player = Player(id=_new_uuid(), user_id=user.id, name="Bob P", telegram_id=111)
        s.add(player)
        await s.commit()
        await s.delete(user)
        await s.commit()
        result = await s.execute(select(Player).where(Player.user_id == user.id))
        assert result.scalar_one_or_none() is None  # cascade delete
```

- [ ] **Step 2: Run test — expect failure**

```bash
pytest tests/test_db.py -v
```

Expected: `ImportError: cannot import name 'Base' from 'app.db'`

- [ ] **Step 3: Create app/db.py**

```python
import uuid
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import DATABASE_URL


def _new_uuid() -> str:
    return str(uuid.uuid4())


engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Create app/models_db.py**

```python
from datetime import datetime
from sqlalchemy import String, BigInteger, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base, _new_uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    google_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    lang: Mapped[str] = mapped_column(String, default="es")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    players: Mapped[list["Player"]] = relationship(
        "Player", back_populates="user", cascade="all, delete-orphan"
    )


class Player(Base):
    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", back_populates="players")
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pytest tests/test_db.py -v
```

Expected: `2 passed`

- [ ] **Step 6: Commit**

```bash
git add app/db.py app/models_db.py tests/test_db.py
git commit -m "feat: SQLAlchemy async engine + User/Player ORM models"
```

---

## Task 3: Backend — Alembic migrations

**Files:**
- Create: `alembic.ini`
- Create: `alembic/env.py`
- Create: `alembic/versions/0001_initial.py`

- [ ] **Step 1: Init Alembic**

```bash
alembic init alembic
```

Expected: creates `alembic.ini` and `alembic/` directory.

- [ ] **Step 2: Edit alembic.ini — set sqlalchemy.url**

In `alembic.ini`, replace the `sqlalchemy.url` line:

```ini
sqlalchemy.url = sqlite:///./impostor.db
```

This is a sync URL for Alembic's autogenerate — the app uses the async URL at runtime.

- [ ] **Step 3: Replace alembic/env.py**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from app.models_db import Base  # noqa: F401 — ensures models are registered

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate first migration**

```bash
alembic revision --autogenerate -m "initial"
```

Expected: creates `alembic/versions/xxxx_initial.py` with `create_table` ops for `users` and `players`.

- [ ] **Step 5: Run migration**

```bash
alembic upgrade head
```

Expected: creates `impostor.db` with `users` and `players` tables. Verify:

```bash
python -c "import sqlite3; c=sqlite3.connect('impostor.db'); print(c.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall())"
```

Expected output includes `users` and `players`.

- [ ] **Step 6: Add impostor.db to .gitignore**

```bash
echo "impostor.db" >> .gitignore
```

- [ ] **Step 7: Commit**

```bash
git add alembic.ini alembic/ .gitignore
git commit -m "feat: Alembic migrations — users and players tables"
```

---

## Task 4: Backend — Auth layer (JWT + Google OAuth)

**Files:**
- Create: `app/auth.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_auth_unit.py`:

```python
from app.auth import create_access_token, decode_token
from jose import JWTError
import pytest


def test_token_roundtrip():
    token = create_access_token("user-abc")
    assert decode_token(token) == "user-abc"


def test_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_token("not.a.token")
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_auth_unit.py -v
```

Expected: `ImportError: cannot import name 'create_access_token' from 'app.auth'`

- [ ] **Step 3: Create app/auth.py**

```python
from datetime import datetime, timedelta
import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import JWT_SECRET_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET_KEY, algorithm=_ALGORITHM)


def decode_token(token: str) -> str:
    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[_ALGORITHM])
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise JWTError("missing sub")
    return user_id


async def exchange_google_code(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        userinfo_resp.raise_for_status()
        return userinfo_resp.json()  # {id, email, name}


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str | None:
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    user_id = await get_current_user_optional(credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user_id
```

- [ ] **Step 4: Run unit tests — expect pass**

```bash
pytest tests/test_auth_unit.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add app/auth.py tests/test_auth_unit.py
git commit -m "feat: JWT helpers + Google OAuth code exchange"
```

---

## Task 5: Backend — Auth routes + conftest DB fixture

**Files:**
- Create: `app/routes/auth.py`
- Modify: `tests/conftest.py`
- Create: `tests/test_auth.py`

- [ ] **Step 1: Create app/routes/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db import get_db, _new_uuid
from app.models_db import User
from app.auth import exchange_google_code, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleCodeRequest(BaseModel):
    code: str
    redirect_uri: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    lang: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/google", response_model=TokenResponse)
async def google_auth(req: GoogleCodeRequest, db: AsyncSession = Depends(get_db)):
    try:
        userinfo = await exchange_google_code(req.code, req.redirect_uri)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Google authorization code")

    result = await db.execute(select(User).where(User.google_id == userinfo["id"]))
    user = result.scalar_one_or_none()

    if user:
        user.email = userinfo["email"]
        user.name = userinfo["name"]
    else:
        user = User(
            id=_new_uuid(),
            google_id=userinfo["id"],
            email=userinfo["email"],
            name=userinfo["name"],
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserOut(id=user.id, email=user.email, name=user.name, lang=user.lang),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user_id: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(id=user.id, email=user.email, name=user.name, lang=user.lang)


@router.delete("/me", status_code=204)
async def delete_me(user_id: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        await db.delete(user)
        await db.commit()
```

- [ ] **Step 2: Replace tests/conftest.py with updated version**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from unittest.mock import AsyncMock
from app.main import app
from app.db import Base, get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_engine():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def client(db_session):
    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def mock_llm():
    m = AsyncMock()
    m.pick_word.return_value = "perro"
    m.pick_hint.return_value = "fiel"
    m.pick_mirror_word.return_value = "gato"
    m.validate_category.return_value = True
    return m


@pytest.fixture
def mock_messaging():
    m = AsyncMock()
    m.send.return_value = True
    return m
```

- [ ] **Step 3: Write tests/test_auth.py**

```python
import pytest
import respx
import httpx
from app.auth import create_access_token


@pytest.fixture
def google_mocks():
    with respx.mock:
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=httpx.Response(200, json={"access_token": "fake-google-token"})
        )
        respx.get("https://www.googleapis.com/oauth2/v2/userinfo").mock(
            return_value=httpx.Response(
                200, json={"id": "g-123", "email": "alice@example.com", "name": "Alice"}
            )
        )
        yield


async def test_google_auth_creates_user(client, google_mocks):
    resp = await client.post(
        "/auth/google",
        json={"code": "fake-code", "redirect_uri": "http://localhost:3000"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["lang"] == "es"


async def test_google_auth_bad_code_returns_400(client):
    with respx.mock:
        respx.post("https://oauth2.googleapis.com/token").mock(
            return_value=httpx.Response(400, json={"error": "invalid_grant"})
        )
        resp = await client.post(
            "/auth/google",
            json={"code": "bad-code", "redirect_uri": "http://localhost:3000"},
        )
    assert resp.status_code == 400


async def test_get_me(client, google_mocks):
    # Create user first
    auth_resp = await client.post(
        "/auth/google",
        json={"code": "fake-code", "redirect_uri": "http://localhost:3000"},
    )
    token = auth_resp.json()["access_token"]

    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "alice@example.com"


async def test_get_me_without_token_returns_401(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_delete_me(client, google_mocks):
    auth_resp = await client.post(
        "/auth/google",
        json={"code": "fake-code", "redirect_uri": "http://localhost:3000"},
    )
    token = auth_resp.json()["access_token"]

    resp = await client.delete("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    # Confirm user is gone
    me_resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 404
```

- [ ] **Step 4: Update app/main.py to include auth router**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.db import engine, Base
from app.routes.game import router as game_router
from app.routes.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game_router, prefix="/api")
app.include_router(auth_router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_auth.py tests/test_auth_unit.py -v
```

Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add app/routes/auth.py app/main.py tests/conftest.py tests/test_auth.py
git commit -m "feat: Google OAuth → JWT auth endpoints"
```

---

## Task 6: Backend — Player CRUD endpoints

**Files:**
- Create: `app/routes/users.py`
- Create: `tests/test_users.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_users.py`:

```python
import pytest
from app.auth import create_access_token
from app.db import _new_uuid
from app.models_db import User


@pytest.fixture
async def auth_user(db_session):
    user = User(id=_new_uuid(), google_id="g-test", email="t@t.com", name="Tester")
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
def auth_headers(auth_user):
    token = create_access_token(auth_user.id)
    return {"Authorization": f"Bearer {token}"}


async def test_list_players_empty(client, auth_user, auth_headers):
    resp = await client.get("/users/players", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_create_player(client, auth_user, auth_headers):
    resp = await client.post(
        "/users/players",
        json={"name": "Marco", "telegram_id": 123456},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Marco"
    assert data["telegram_id"] == 123456
    assert "id" in data


async def test_delete_player(client, auth_user, auth_headers):
    create_resp = await client.post(
        "/users/players",
        json={"name": "Pipe", "telegram_id": 999},
        headers=auth_headers,
    )
    player_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/users/players/{player_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    list_resp = await client.get("/users/players", headers=auth_headers)
    assert list_resp.json() == []


async def test_delete_other_users_player_returns_404(client, db_session, auth_user, auth_headers):
    other = User(id=_new_uuid(), google_id="g-other", email="o@o.com", name="Other")
    db_session.add(other)
    await db_session.commit()

    other_token = create_access_token(other.id)
    create_resp = await client.post(
        "/users/players",
        json={"name": "X", "telegram_id": 1},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    player_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/users/players/{player_id}", headers=auth_headers)
    assert del_resp.status_code == 404


async def test_players_requires_auth(client):
    resp = await client.get("/users/players")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_users.py -v
```

Expected: `ImportError` or `404` (router not registered yet)

- [ ] **Step 3: Create app/routes/users.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.db import get_db, _new_uuid
from app.models_db import Player
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


class PlayerCreate(BaseModel):
    name: str
    telegram_id: int


class PlayerOut(BaseModel):
    id: str
    name: str
    telegram_id: int


@router.get("/players", response_model=list[PlayerOut])
async def list_players(
    user_id: str = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Player).where(Player.user_id == user_id))
    return [PlayerOut(id=p.id, name=p.name, telegram_id=p.telegram_id) for p in result.scalars()]


@router.post("/players", response_model=PlayerOut, status_code=201)
async def create_player(
    body: PlayerCreate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    player = Player(id=_new_uuid(), user_id=user_id, name=body.name, telegram_id=body.telegram_id)
    db.add(player)
    await db.commit()
    await db.refresh(player)
    return PlayerOut(id=player.id, name=player.name, telegram_id=player.telegram_id)


@router.delete("/players/{player_id}", status_code=204)
async def delete_player(
    player_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Player).where(Player.id == player_id, Player.user_id == user_id)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    await db.delete(player)
    await db.commit()
```

- [ ] **Step 4: Register users router in app/main.py**

Add to imports:
```python
from app.routes.users import router as users_router
```

Add after existing `include_router` calls:
```python
app.include_router(users_router)
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pytest tests/test_users.py -v
```

Expected: `5 passed`

- [ ] **Step 6: Run full test suite**

```bash
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/routes/users.py tests/test_users.py app/main.py
git commit -m "feat: player CRUD endpoints with auth guard"
```

---

## Task 7: Frontend — Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test-utils.tsx`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Install testing deps**

```bash
cd /path/to/impostor-web
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
  },
})
```

- [ ] **Step 4: Create src/test-setup.ts**

```typescript
import "@testing-library/jest-dom"
```

- [ ] **Step 5: Create a smoke test to verify setup**

Create `src/components/__tests__/smoke.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react"

test("vitest renders React", () => {
  render(<div>hello</div>)
  expect(screen.getByText("hello")).toBeInTheDocument()
})
```

- [ ] **Step 6: Run test**

```bash
npm run test -- --run
```

Expected: `1 passed`

- [ ] **Step 7: Update .github/workflows/ci.yml — add test step before build**

Find the build step and add before it:
```yaml
      - name: Test
        run: npm run test -- --run
```

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts src/test-setup.ts src/components/__tests__/smoke.test.tsx package.json .github/workflows/ci.yml
git commit -m "chore: add Vitest + Testing Library setup"
```

---

## Task 8: Frontend — Types, API layer, AuthContext

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/auth.ts`
- Create: `src/api/users.ts`
- Create: `src/contexts/AuthContext.tsx`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Modify: `.env.example`

- [ ] **Step 1: Add AuthUser to src/types/index.ts**

At the end of the existing file, append:

```typescript
export interface AuthUser {
  id: string
  email: string
  name: string
  lang: string
}
```

- [ ] **Step 2: Create src/api/auth.ts**

```typescript
import type { AuthUser } from "../types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface TokenResponse {
  access_token: string
  token_type: string
  user: AuthUser
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
  if (!res.ok) throw new Error("Google auth failed")
  return res.json()
}

export async function getMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Not authenticated")
  return res.json()
}

export function authFetch(token: string, input: RequestInfo, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
}
```

- [ ] **Step 3: Create src/api/users.ts**

```typescript
import type { Player } from "../types"
import { authFetch } from "./auth"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export interface PlayerCreate {
  name: string
  telegram_id: number
}

export async function listPlayers(token: string): Promise<Player[]> {
  const res = await authFetch(token, `${API_URL}/users/players`)
  if (!res.ok) throw new Error("Failed to load players")
  return res.json()
}

export async function createPlayer(token: string, data: PlayerCreate): Promise<Player> {
  const res = await authFetch(token, `${API_URL}/users/players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error("Failed to create player")
  return res.json()
}

export async function deletePlayer(token: string, playerId: string): Promise<void> {
  const res = await authFetch(token, `${API_URL}/users/players/${playerId}`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to delete player")
}
```

- [ ] **Step 4: Create src/contexts/AuthContext.tsx**

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { AuthUser } from "../types"
import { exchangeGoogleCode, getMe } from "../api/auth"

const JWT_KEY = "impostor_jwt"
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function requestGoogleCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as any
    if (!w.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services not loaded"))
      return
    }
    w.google.accounts.oauth2
      .initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "email profile",
        callback: (response: { code?: string; error?: string }) => {
          if (response.code) resolve(response.code)
          else reject(new Error(response.error ?? "OAuth cancelled"))
        },
      })
      .requestCode()
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem(JWT_KEY))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    getMe(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(JWT_KEY)
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = async () => {
    setIsLoading(true)
    try {
      const code = await requestGoogleCode()
      const result = await exchangeGoogleCode(code, window.location.origin)
      localStorage.setItem(JWT_KEY, result.access_token)
      setToken(result.access_token)
      setUser(result.user)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(JWT_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

- [ ] **Step 5: Wrap app in AuthProvider — update src/main.tsx**

```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { AuthProvider } from "./contexts/AuthContext"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)
```

- [ ] **Step 6: Add Google Identity Services script to index.html**

Before the closing `</head>` tag, add:
```html
    <script src="https://accounts.google.com/gsi/client" async></script>
```

- [ ] **Step 7: Update .env.example**

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/api/auth.ts src/api/users.ts src/contexts/AuthContext.tsx src/main.tsx index.html .env.example
git commit -m "feat: AuthContext + Google OAuth + API auth/users layer"
```

---

## Task 9: Frontend — Update usePlayers to sync with backend

**Files:**
- Modify: `src/hooks/usePlayers.ts`
- Create: `src/hooks/__tests__/usePlayers.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/hooks/__tests__/usePlayers.test.tsx`:

```tsx
import { renderHook, act, waitFor } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { AuthContext } from "../../contexts/AuthContext"
import { usePlayers } from "../usePlayers"
import * as usersApi from "../../api/users"
import type { ReactNode } from "react"

const mockToken = "fake-jwt"
const mockUser = { id: "u1", email: "a@b.com", name: "Alice", lang: "es" }

function wrapAuth(user: typeof mockUser | null, token: string | null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider
      value={{ user, token, isLoading: false, login: vi.fn(), logout: vi.fn() }}
    >
      {children}
    </AuthContext.Provider>
  )
}

describe("usePlayers — anonymous", () => {
  beforeEach(() => localStorage.clear())

  it("starts empty", () => {
    const { result } = renderHook(() => usePlayers(), { wrapper: wrapAuth(null, null) })
    expect(result.current.players).toEqual([])
  })

  it("addPlayer persists to localStorage", async () => {
    const { result } = renderHook(() => usePlayers(), { wrapper: wrapAuth(null, null) })
    await act(async () => result.current.addPlayer("Marco", 111))
    expect(result.current.players[0].name).toBe("Marco")
    expect(localStorage.getItem("impostor_players")).toContain("Marco")
  })
})

describe("usePlayers — authenticated", () => {
  beforeEach(() => {
    vi.spyOn(usersApi, "listPlayers").mockResolvedValue([
      { id: "p1", name: "Pipe", telegram_id: 222 },
    ])
    vi.spyOn(usersApi, "createPlayer").mockResolvedValue({ id: "p2", name: "Laura", telegram_id: 333 })
    vi.spyOn(usersApi, "deletePlayer").mockResolvedValue(undefined)
  })

  it("loads players from API", async () => {
    const { result } = renderHook(() => usePlayers(), { wrapper: wrapAuth(mockUser, mockToken) })
    await waitFor(() => expect(result.current.players).toHaveLength(1))
    expect(result.current.players[0].name).toBe("Pipe")
    expect(usersApi.listPlayers).toHaveBeenCalledWith(mockToken)
  })

  it("addPlayer calls API", async () => {
    const { result } = renderHook(() => usePlayers(), { wrapper: wrapAuth(mockUser, mockToken) })
    await waitFor(() => expect(result.current.players).toHaveLength(1))
    await act(async () => result.current.addPlayer("Laura", 333))
    expect(usersApi.createPlayer).toHaveBeenCalledWith(mockToken, { name: "Laura", telegram_id: 333 })
  })
})
```

- [ ] **Step 2: Run — expect failure (AuthContext not exported, usePlayers not updated)**

```bash
npm run test -- --run src/hooks/__tests__/usePlayers.test.tsx
```

Expected: failures about missing exports or wrong behavior

- [ ] **Step 3: Export AuthContext from AuthContext.tsx**

At the top of `src/contexts/AuthContext.tsx`, the `AuthContext` is already declared. Ensure it's exported:

```typescript
export const AuthContext = createContext<AuthContextValue | null>(null)
```

(Change `const AuthContext` → `export const AuthContext`)

- [ ] **Step 4: Rewrite src/hooks/usePlayers.ts**

```typescript
import { useState, useEffect } from "react"
import type { Player } from "../types"
import { useAuth } from "../contexts/AuthContext"
import { listPlayers, createPlayer, deletePlayer } from "../api/users"

const LS_KEY = "impostor_players"

function loadFromStorage(): Player[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")
  } catch {
    return []
  }
}

export function usePlayers() {
  const { user, token } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])

  // Load players: API if authenticated, localStorage if not
  useEffect(() => {
    if (user && token) {
      listPlayers(token)
        .then((remote) => {
          setPlayers(remote)
        })
        .catch(() => setPlayers([]))
    } else {
      setPlayers(loadFromStorage())
    }
  }, [user, token])

  // Merge localStorage → API on login (runs once when user becomes non-null)
  useEffect(() => {
    if (!user || !token) return
    const local = loadFromStorage()
    if (local.length === 0) return

    const remoteIds = players.map((p) => p.telegram_id)
    const toMerge = local.filter((p) => !remoteIds.includes(p.telegram_id))
    Promise.all(toMerge.map((p) => createPlayer(token, { name: p.name, telegram_id: p.telegram_id })))
      .then((created) => setPlayers((prev) => [...prev, ...created]))
      .catch(() => {})
    localStorage.removeItem(LS_KEY)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const addPlayer = async (name: string, telegram_id: number) => {
    if (user && token) {
      const player = await createPlayer(token, { name, telegram_id })
      setPlayers((prev) => [...prev, player])
    } else {
      const player: Player = { id: crypto.randomUUID(), name, telegram_id }
      const updated = [...players, player]
      setPlayers(updated)
      localStorage.setItem(LS_KEY, JSON.stringify(updated))
    }
  }

  const removePlayer = async (id: string) => {
    if (user && token) {
      await deletePlayer(token, id)
      setPlayers((prev) => prev.filter((p) => p.id !== id))
    } else {
      const updated = players.filter((p) => p.id !== id)
      setPlayers(updated)
      localStorage.setItem(LS_KEY, JSON.stringify(updated))
    }
  }

  return { players, addPlayer, removePlayer }
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test -- --run src/hooks/__tests__/usePlayers.test.tsx
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePlayers.ts src/contexts/AuthContext.tsx src/hooks/__tests__/usePlayers.test.tsx
git commit -m "feat: usePlayers syncs with backend when authenticated"
```

---

## Task 10: Frontend — AuthButton component + header wiring

**Files:**
- Create: `src/components/AuthButton.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create src/components/AuthButton.tsx**

```tsx
import { useAuth } from "../contexts/AuthContext"

export default function AuthButton() {
  const { user, isLoading, login, logout } = useAuth()

  if (isLoading) {
    return <div className="w-24 h-8 rounded-full bg-white/10 animate-pulse" />
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/70 max-w-[100px] truncate">{user.name}</span>
        <button
          onClick={logout}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          Salir
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:border-white/40 hover:text-white transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Iniciar sesión
    </button>
  )
}
```

- [ ] **Step 2: Add AuthButton to App.tsx header**

In `src/App.tsx`, find the header section and add `AuthButton`. The header should look like:

```tsx
import AuthButton from "./components/AuthButton"

// In the header JSX:
<header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0D0D0F]/80 backdrop-blur">
  <h1 className="text-lg font-bold tracking-tight">El Impostor</h1>
  <div className="flex items-center gap-3">
    <button onClick={() => setDrawerOpen(true)} className="relative p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Configuración">
      <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {players.length > 0 && (
        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-violet-600 text-[10px] flex items-center justify-center font-bold">
          {players.length}
        </span>
      )}
    </button>
    <AuthButton />
  </div>
</header>
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: builds successfully with no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AuthButton.tsx src/App.tsx
git commit -m "feat: AuthButton in header — Google login/logout UI"
```

---

## Task 11: Run full test suite and push both repos

- [ ] **Step 1: Run backend tests**

```bash
cd impostor-api
pytest tests/ -v
```

Expected: all tests pass (including pre-existing 4 game tests + new auth + users tests)

- [ ] **Step 2: Run lint**

```bash
ruff check .
```

Expected: no issues

- [ ] **Step 3: Run frontend tests**

```bash
cd impostor-web
npm run test -- --run
```

Expected: all tests pass

- [ ] **Step 4: Run frontend build**

```bash
npm run build
```

Expected: build succeeds

- [ ] **Step 5: Push both repos**

```bash
cd impostor-api && git push
cd impostor-web && git push
```

Expected: CI passes on both (lint + pytest / lint + test + build)
