# i18n + Tutorial + Google Ads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spanish/English i18n with a language selector, improve the Telegram ID tutorial with a visual step guide, and add Google AdSense slots that only render for unauthenticated users.

**Architecture:** `react-i18next` with namespace-per-section locale files. Language stored in localStorage (or backend preference for auth'd users). Backend gains a `lang` param that selects Telegram message language. Tutorial is a pure component update. `AdSlot` wraps AdSense and renders conditionally based on auth state and env var presence.

**Tech Stack:** `react-i18next` · `i18next` · `i18next-browser-languagedetector` · Google AdSense (script only, no npm). No new backend deps.

**Prerequisites:** Plan 1 (Auth) for the language preference endpoint. Plans 2 and 3 can run before or after this one.

---

## File Map

### impostor-web

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/i18n/index.ts` | i18next init, language detector, fallback |
| Create | `src/i18n/locales/es/common.json` | All Spanish UI strings |
| Create | `src/i18n/locales/en/common.json` | All English UI strings |
| Create | `src/components/LanguageSelector.tsx` | ES/EN pill toggle in header |
| Modify | `src/main.tsx` | Import i18n init |
| Modify | `src/App.tsx` | Replace hardcoded strings with `useTranslation`, add LanguageSelector |
| Modify | `src/components/ModeCard.tsx` | Translated mode labels/descriptions |
| Modify | `src/components/DifficultyToggle.tsx` | Translated labels |
| Modify | `src/components/PlayerList.tsx` | Translated placeholders/labels |
| Modify | `src/components/GameResult.tsx` | Translated labels |
| Modify | `src/components/Tutorial.tsx` | Visual steps + `@userinfobot` link |
| Modify | `src/components/ConfigDrawer.tsx` | Translated title |
| Create | `src/components/AdSlot.tsx` | Conditional AdSense slot |
| Modify | `src/App.tsx` | Add AdSlot in two placements |
| Modify | `index.html` | AdSense script tag (if env var set) |
| Modify | `.env.example` | VITE_ADSENSE_ID |
| Create | `src/components/__tests__/AdSlot.test.tsx` | Renders only when expected |
| Create | `src/components/__tests__/LanguageSelector.test.tsx` | Switches language |

### impostor-api

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/game/engine.py` | `_build_message` uses `lang` param (already added in Plan 2 — verify) |
| Modify | `app/routes/users.py` | Add PATCH /users/preferences (lang) |
| Create | `tests/test_preferences.py` | Preference update test |

---

## Task 1: Backend — Language preference endpoint

**Files:**
- Modify: `app/routes/users.py`
- Create: `tests/test_preferences.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_preferences.py`:

```python
import pytest
from app.auth import create_access_token
from app.db import _new_uuid
from app.models_db import User
from sqlalchemy import select


@pytest.fixture
async def auth_user_pref(db_session):
    user = User(id=_new_uuid(), google_id="g-pref", email="p@p.com", name="Preftest")
    db_session.add(user)
    await db_session.commit()
    return user


async def test_update_language_preference(client, auth_user_pref, db_session):
    token = create_access_token(auth_user_pref.id)
    resp = await client.patch(
        "/users/preferences",
        json={"lang": "en"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["lang"] == "en"

    # Verify persisted
    result = await db_session.execute(select(User).where(User.id == auth_user_pref.id))
    user = result.scalar_one()
    assert user.lang == "en"


async def test_invalid_lang_returns_422(client, auth_user_pref):
    token = create_access_token(auth_user_pref.id)
    resp = await client.patch(
        "/users/preferences",
        json={"lang": "fr"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422
```

- [ ] **Step 2: Run — expect failure**

```bash
pytest tests/test_preferences.py -v
```

Expected: `404 Not Found` (route doesn't exist yet)

- [ ] **Step 3: Add PATCH /users/preferences to app/routes/users.py**

```python
from pydantic import field_validator

class PreferencesUpdate(BaseModel):
    lang: str

    @field_validator("lang")
    @classmethod
    def validate_lang(cls, v: str) -> str:
        if v not in ("es", "en"):
            raise ValueError("lang must be 'es' or 'en'")
        return v


@router.patch("/preferences")
async def update_preferences(
    body: PreferencesUpdate,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.lang = body.lang
    await db.commit()
    return {"id": user.id, "email": user.email, "name": user.name, "lang": user.lang}
```

Add `from app.models_db import User` import at top of `app/routes/users.py` if not already there.

- [ ] **Step 4: Run tests — expect pass**

```bash
pytest tests/test_preferences.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Run full backend suite**

```bash
pytest tests/ -v
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add app/routes/users.py tests/test_preferences.py
git commit -m "feat: PATCH /users/preferences — language preference endpoint"
```

---

## Task 2: Frontend — i18n setup + locale files

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/es/common.json`
- Create: `src/i18n/locales/en/common.json`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install i18next**

```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

- [ ] **Step 2: Create src/i18n/locales/es/common.json**

```json
{
  "header": {
    "title": "El Impostor",
    "settings": "Configuración",
    "history": "Historial",
    "login": "Iniciar sesión",
    "logout": "Salir"
  },
  "mode": {
    "label": "Modo",
    "clasico": "Clásico",
    "caos": "Caos",
    "ciego": "Ciego",
    "aliados": "Aliados",
    "espejo": "Espejo",
    "clasicoDesc": "Exactamente 1 impostor",
    "caosDesc": "N impostores aleatorio",
    "ciegoDesc": "Nadie sabe cuántos hay",
    "aliadosDesc": "2 impostores que se conocen",
    "espejoDesc": "El impostor recibe otra palabra"
  },
  "difficulty": {
    "label": "Pista",
    "facil": "Fácil",
    "dificil": "Difícil",
    "brutal": "Brutal"
  },
  "wordDifficulty": {
    "label": "Palabras",
    "popular": "Populares",
    "obscuro": "Oscuras"
  },
  "category": {
    "label": "Categoría",
    "random": "Aleatoria",
    "propose": "Proponer categoría...",
    "validate": "Validar",
    "validating": "...",
    "selected": "Categoría seleccionada:",
    "invalidError": "Esa categoría no es válida para el juego. Prueba otra.",
    "fetchError": "Error al validar la categoría."
  },
  "impostors": {
    "label": "N° de impostores"
  },
  "players": {
    "title": "Jugadores",
    "namePlaceholder": "Nombre",
    "telegramPlaceholder": "Telegram ID",
    "add": "Agregar",
    "empty": "No hay jugadores aún",
    "syncNudge": "Inicia sesión para sincronizar tus jugadores en todos tus dispositivos"
  },
  "play": {
    "button": "Jugar",
    "noPlayers": "Agrega jugadores primero",
    "loading": "Enviando mensajes..."
  },
  "result": {
    "title": "¡Partida enviada!",
    "category": "Categoría",
    "mode": "Modo",
    "impostors": "Impostores",
    "sent": "Recibieron el mensaje",
    "failed": "No recibieron",
    "failedBadge": "no inició el bot",
    "again": "Otra ronda 🎲",
    "loginNudge": "para guardar tu historial en todos tus dispositivos",
    "loginLink": "Inicia sesión"
  },
  "history": {
    "title": "Historial",
    "empty": "No hay partidas aún",
    "anonNudge": "Mostrando las últimas {{count}} rondas de este dispositivo.",
    "loginLink": "Inicia sesión para ver el historial completo",
    "showing": "Mostrando {{current}} de {{total}} rondas"
  },
  "tutorial": {
    "title": "¿Cómo funciona?",
    "step1Title": "Busca el bot",
    "step1Body": "Abre Telegram y busca el bot del juego. Todos los jugadores deben agregarle.",
    "step2Title": "Obtén tu Telegram ID",
    "step2Body": "Escríbele a @userinfobot en Telegram. Reenvía cualquier mensaje y te responderá con tu ID numérico.",
    "step2Link": "Abrir @userinfobot",
    "step3Title": "Agrega los jugadores",
    "step3Body": "En la configuración (⚙️), ingresa el nombre y el ID de cada jugador.",
    "step4Title": "Elige el modo y juega",
    "step4Body": "El anfitrión elige el modo, la dificultad y presiona Jugar. Cada jugador recibe su rol por Telegram.",
    "step5Title": "¡A debatir!",
    "step5Body": "Todos deben convencer al grupo de que no son el impostor. Al final, voten."
  },
  "ads": {
    "label": "Publicidad"
  }
}
```

- [ ] **Step 3: Create src/i18n/locales/en/common.json**

```json
{
  "header": {
    "title": "El Impostor",
    "settings": "Settings",
    "history": "History",
    "login": "Sign in",
    "logout": "Sign out"
  },
  "mode": {
    "label": "Mode",
    "clasico": "Classic",
    "caos": "Chaos",
    "ciego": "Blind",
    "aliados": "Allies",
    "espejo": "Mirror",
    "clasicoDesc": "Exactly 1 impostor",
    "caosDesc": "Random number of impostors",
    "ciegoDesc": "Nobody knows how many",
    "aliadosDesc": "2 impostors who know each other",
    "espejoDesc": "Impostor gets a different word"
  },
  "difficulty": {
    "label": "Hint",
    "facil": "Easy",
    "dificil": "Hard",
    "brutal": "Brutal"
  },
  "wordDifficulty": {
    "label": "Words",
    "popular": "Popular",
    "obscuro": "Obscure"
  },
  "category": {
    "label": "Category",
    "random": "Random",
    "propose": "Propose a category...",
    "validate": "Check",
    "validating": "...",
    "selected": "Selected category:",
    "invalidError": "That category is not valid for the game. Try another one.",
    "fetchError": "Error validating category."
  },
  "impostors": {
    "label": "# of impostors"
  },
  "players": {
    "title": "Players",
    "namePlaceholder": "Name",
    "telegramPlaceholder": "Telegram ID",
    "add": "Add",
    "empty": "No players yet",
    "syncNudge": "Sign in to sync your players across all devices"
  },
  "play": {
    "button": "Play",
    "noPlayers": "Add players first",
    "loading": "Sending messages..."
  },
  "result": {
    "title": "Round sent!",
    "category": "Category",
    "mode": "Mode",
    "impostors": "Impostors",
    "sent": "Received the message",
    "failed": "Didn't receive",
    "failedBadge": "hasn't started the bot",
    "again": "Another round 🎲",
    "loginNudge": "to save your history across all devices",
    "loginLink": "Sign in"
  },
  "history": {
    "title": "History",
    "empty": "No games yet",
    "anonNudge": "Showing the last {{count}} rounds on this device.",
    "loginLink": "Sign in to see your full history",
    "showing": "Showing {{current}} of {{total}} rounds"
  },
  "tutorial": {
    "title": "How it works",
    "step1Title": "Find the bot",
    "step1Body": "Open Telegram and find the game bot. All players must add it first.",
    "step2Title": "Get your Telegram ID",
    "step2Body": "Message @userinfobot on Telegram. Forward any message to it and it'll reply with your numeric ID.",
    "step2Link": "Open @userinfobot",
    "step3Title": "Add players",
    "step3Body": "In settings (⚙️), enter each player's name and Telegram ID.",
    "step4Title": "Choose mode and play",
    "step4Body": "The host chooses mode, difficulty, and hits Play. Each player receives their role on Telegram.",
    "step5Title": "Start debating!",
    "step5Body": "Everyone must convince the group they're not the impostor. At the end, vote."
  },
  "ads": {
    "label": "Advertisement"
  }
}
```

- [ ] **Step 4: Create src/i18n/index.ts**

```typescript
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import esCommon from "./locales/es/common.json"
import enCommon from "./locales/en/common.json"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { common: esCommon },
      en: { common: enCommon },
    },
    defaultNS: "common",
    fallbackLng: "es",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "impostor_lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
```

- [ ] **Step 5: Import i18n in src/main.tsx**

Add as the first import (before React):

```typescript
import "./i18n"
```

Full `src/main.tsx`:

```tsx
import "./i18n"
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

- [ ] **Step 6: Build to verify i18n loads**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/i18n/ src/main.tsx package.json package-lock.json
git commit -m "feat: i18next setup with ES/EN locale files"
```

---

## Task 3: Frontend — LanguageSelector component

**Files:**
- Create: `src/components/LanguageSelector.tsx`
- Create: `src/components/__tests__/LanguageSelector.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/__tests__/LanguageSelector.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { vi, it, expect, beforeEach } from "vitest"
import LanguageSelector from "../LanguageSelector"
import i18n from "../../i18n"

beforeEach(() => {
  i18n.changeLanguage("es")
})

it("shows ES and EN buttons", () => {
  render(<LanguageSelector />)
  expect(screen.getByText("ES")).toBeInTheDocument()
  expect(screen.getByText("EN")).toBeInTheDocument()
})

it("highlights current language", () => {
  render(<LanguageSelector />)
  const esBtn = screen.getByText("ES")
  expect(esBtn.className).toContain("bg-violet")
})

it("switches language on click", () => {
  render(<LanguageSelector />)
  fireEvent.click(screen.getByText("EN"))
  expect(i18n.language).toBe("en")
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm run test -- --run src/components/__tests__/LanguageSelector.test.tsx
```

Expected: `Cannot find module '../LanguageSelector'`

- [ ] **Step 3: Create src/components/LanguageSelector.tsx**

```tsx
import { useTranslation } from "react-i18next"
import { useAuth } from "../contexts/AuthContext"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export default function LanguageSelector() {
  const { i18n } = useTranslation()
  const { user, token } = useAuth()

  const setLang = async (lang: "es" | "en") => {
    await i18n.changeLanguage(lang)
    if (user && token) {
      fetch(`${API_URL}/users/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lang }),
      }).catch(() => {})
    }
  }

  const current = i18n.language.startsWith("en") ? "en" : "es"

  return (
    <div className="flex rounded-full border border-white/20 overflow-hidden text-xs font-bold">
      {(["es", "en"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLang(lang)}
          className={`px-2.5 py-1 transition-colors ${
            current === lang
              ? "bg-violet-600 text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test -- --run src/components/__tests__/LanguageSelector.test.tsx
```

Expected: `3 passed`

- [ ] **Step 5: Add LanguageSelector to App.tsx header**

In the header div with `flex items-center gap-3`, add `<LanguageSelector />` before the history button:

```tsx
import LanguageSelector from "./components/LanguageSelector"

// In header:
<LanguageSelector />
<button onClick={() => setHistoryOpen(true)} ...>
```

- [ ] **Step 6: Replace hardcoded strings in App.tsx with useTranslation**

At the top of `App.tsx`:
```tsx
import { useTranslation } from "react-i18next"

// Inside App:
const { t } = useTranslation()

// Replace strings:
// "Jugar" → {t("play.button")}
// "Cargando..." → {t("play.loading")}
// "Agrega jugadores primero" → {t("play.noPlayers")}
// "Configuración" aria-label → {t("header.settings")}
// "Historial" aria-label → {t("header.history")}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/LanguageSelector.tsx src/components/__tests__/LanguageSelector.test.tsx src/App.tsx
git commit -m "feat: LanguageSelector + i18n strings in App"
```

---

## Task 4: Frontend — Translate all components

**Files:**
- Modify: `src/components/ModeCard.tsx`
- Modify: `src/components/DifficultyToggle.tsx`
- Modify: `src/components/PlayerList.tsx`
- Modify: `src/components/GameResult.tsx`
- Modify: `src/components/ConfigDrawer.tsx`
- Modify: `src/components/CategorySelector.tsx`

For each component, add `const { t } = useTranslation()` and replace hardcoded strings.

- [ ] **Step 1: Update ModeCard.tsx**

```tsx
import { useTranslation } from "react-i18next"
import type { Mode } from "../types"

const MODE_CONFIG: { mode: Mode; emoji: string; labelKey: string; descKey: string }[] = [
  { mode: "clasico", emoji: "🎭", labelKey: "mode.clasico", descKey: "mode.clasicoDesc" },
  { mode: "caos",    emoji: "🌀", labelKey: "mode.caos",    descKey: "mode.caosDesc" },
  { mode: "ciego",   emoji: "👁️",  labelKey: "mode.ciego",   descKey: "mode.ciegoDesc" },
  { mode: "aliados", emoji: "🤝", labelKey: "mode.aliados", descKey: "mode.aliadosDesc" },
  { mode: "espejo",  emoji: "🪞",  labelKey: "mode.espejo",  descKey: "mode.espejoDesc" },
]

interface ModeCardProps {
  selected: Mode
  onChange: (mode: Mode) => void
}

export default function ModeCard({ selected, onChange }: ModeCardProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-white/70 uppercase tracking-wide">{t("mode.label")}</span>
      <div className="grid grid-cols-2 gap-2">
        {MODE_CONFIG.map(({ mode, emoji, labelKey, descKey }) => (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
              selected === mode
                ? "border-violet-600 bg-violet-600/15 text-white"
                : "border-white/10 text-white/60 hover:border-white/30 hover:text-white/80"
            }`}
          >
            <span className="text-xl mb-1">{emoji}</span>
            <span className="font-semibold text-sm">{t(labelKey)}</span>
            <span className="text-xs text-white/40 mt-0.5">{t(descKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update DifficultyToggle.tsx**

```tsx
import { useTranslation } from "react-i18next"
import type { Difficulty } from "../types"

const LEVELS: { value: Difficulty; labelKey: string }[] = [
  { value: "facil", labelKey: "difficulty.facil" },
  { value: "dificil", labelKey: "difficulty.dificil" },
  { value: "brutal", labelKey: "difficulty.brutal" },
]

interface DifficultyToggleProps {
  selected: Difficulty
  onChange: (d: Difficulty) => void
}

export default function DifficultyToggle({ selected, onChange }: DifficultyToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-white/70 uppercase tracking-wide">{t("difficulty.label")}</span>
      <div className="flex rounded-xl border border-white/10 overflow-hidden">
        {LEVELS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              selected === value
                ? "bg-violet-600 text-white"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update PlayerList.tsx**

Replace hardcoded strings with `t("players.namePlaceholder")`, `t("players.telegramPlaceholder")`, `t("players.add")`, `t("players.empty")`, `t("players.syncNudge")`.

Import `useTranslation` at top: `import { useTranslation } from "react-i18next"`
Add inside component: `const { t } = useTranslation()`

- [ ] **Step 4: Update GameResult.tsx**

Replace all hardcoded strings with t() keys matching `result.*` in the locale files. Add `useTranslation` import and hook.

- [ ] **Step 5: Update CategorySelector.tsx**

Replace `"Aleatoria"` → `{t("category.random")}`, `"Proponer categoría..."` → `{t("category.propose")}`, etc.

- [ ] **Step 6: Update ConfigDrawer.tsx**

Replace title `"Jugadores"` → `{t("players.title")}`.

- [ ] **Step 7: Build — verify no errors**

```bash
npm run build
```

Expected: builds clean

- [ ] **Step 8: Run all tests**

```bash
npm run test -- --run
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add src/components/
git commit -m "feat: i18n — all components use react-i18next translations"
```

---

## Task 5: Frontend — Tutorial visual redesign

**Files:**
- Modify: `src/components/Tutorial.tsx`

- [ ] **Step 1: Rewrite src/components/Tutorial.tsx**

```tsx
import { useState } from "react"
import { useTranslation } from "react-i18next"

interface Step {
  titleKey: string
  bodyKey: string
  icon: string
  linkKey?: string
  linkHref?: string
}

const STEPS: Step[] = [
  { icon: "🤖", titleKey: "tutorial.step1Title", bodyKey: "tutorial.step1Body" },
  {
    icon: "🆔",
    titleKey: "tutorial.step2Title",
    bodyKey: "tutorial.step2Body",
    linkKey: "tutorial.step2Link",
    linkHref: "https://t.me/userinfobot",
  },
  { icon: "⚙️", titleKey: "tutorial.step3Title", bodyKey: "tutorial.step3Body" },
  { icon: "🎮", titleKey: "tutorial.step4Title", bodyKey: "tutorial.step4Body" },
  { icon: "💬", titleKey: "tutorial.step5Title", bodyKey: "tutorial.step5Body" },
]

export default function Tutorial() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/60 hover:text-white/90 transition-colors"
      >
        <span>{t("tutorial.title")}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center text-base">
                {step.icon}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white/30">Paso {i + 1}</span>
                  <span className="text-sm font-semibold text-white">{t(step.titleKey)}</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{t(step.bodyKey)}</p>
                {step.linkKey && step.linkHref && (
                  <a
                    href={step.linkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-1"
                  >
                    {t(step.linkKey)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```

Expected: builds clean

- [ ] **Step 3: Commit**

```bash
git add src/components/Tutorial.tsx
git commit -m "feat: Tutorial redesign — visual steps + @userinfobot link"
```

---

## Task 6: Frontend — AdSlot component

**Files:**
- Create: `src/components/AdSlot.tsx`
- Create: `src/components/__tests__/AdSlot.test.tsx`
- Modify: `index.html`
- Modify: `.env.example`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/AdSlot.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect } from "vitest"
import { AuthContext } from "../../contexts/AuthContext"
import AdSlot from "../AdSlot"
import type { ReactNode } from "react"

const mockUser = { id: "u1", email: "a@b.com", name: "Alice", lang: "es" }

function wrap(user: typeof mockUser | null) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ user, token: null, isLoading: false, login: vi.fn(), logout: vi.fn() }}>
      {children}
    </AuthContext.Provider>
  )
}

describe("AdSlot", () => {
  it("renders nothing when user is authenticated", () => {
    const { container } = render(
      <AdSlot slotId="1234567890" />,
      { wrapper: wrap(mockUser) }
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when VITE_ADSENSE_ID is not set", () => {
    // env var not set in test environment
    const { container } = render(
      <AdSlot slotId="1234567890" />,
      { wrapper: wrap(null) }
    )
    // Should render nothing since env var is absent
    expect(container.querySelector(".adsbygoogle")).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
npm run test -- --run src/components/__tests__/AdSlot.test.tsx
```

Expected: `Cannot find module '../AdSlot'`

- [ ] **Step 3: Create src/components/AdSlot.tsx**

```tsx
import { useEffect, useRef } from "react"
import { useAuth } from "../contexts/AuthContext"

interface AdSlotProps {
  slotId: string
  format?: "auto" | "rectangle" | "leaderboard"
  className?: string
}

const ADSENSE_ID = import.meta.env.VITE_ADSENSE_ID

export default function AdSlot({ slotId, format = "auto", className = "" }: AdSlotProps) {
  const { user } = useAuth()
  const adRef = useRef<HTMLInsElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!ADSENSE_ID || user || pushed.current) return
    pushed.current = true
    try {
      ;(window as any).adsbygoogle = (window as any).adsbygoogle || []
      ;(window as any).adsbygoogle.push({})
    } catch {
      // AdSense not loaded in dev
    }
  }, [user])

  if (!ADSENSE_ID || user) return null

  return (
    <div className={`text-center ${className}`}>
      <span className="block text-[10px] text-white/20 mb-1 uppercase tracking-wider">
        Publicidad
      </span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_ID}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test -- --run src/components/__tests__/AdSlot.test.tsx
```

Expected: `2 passed`

- [ ] **Step 5: Update .env.example**

```env
VITE_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_ADSENSE_ID=ca-pub-XXXXXXXXXXXXXXXXX
```

- [ ] **Step 6: Add AdSense script to index.html (conditional)**

In `index.html`, the AdSense script cannot be conditionally loaded by Vite env vars at build time without a plugin. Instead, add the script unconditionally but note it only activates when VITE_ADSENSE_ID is set:

Add before `</head>`:
```html
    <!-- AdSense: script loads but AdSlot component won't render slots without VITE_ADSENSE_ID -->
    <!-- Uncomment when you have AdSense approval:
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=REPLACE_WITH_YOUR_PUBLISHER_ID" crossorigin="anonymous"></script>
    -->
```

When ready to activate, uncomment and replace `REPLACE_WITH_YOUR_PUBLISHER_ID` with the actual publisher ID (same as `VITE_ADSENSE_ID`).

- [ ] **Step 7: Add AdSlot to App.tsx — two placements**

```tsx
import AdSlot from "./components/AdSlot"

// Below the header, before the main form:
<AdSlot slotId="REPLACE_WITH_SLOT_ID" format="leaderboard" className="mb-4" />

// In GameResult section, between result and "Otra ronda" button:
// (Pass a prop to GameResult or render inline)
// In GameResult.tsx, before the "Otra ronda" button:
<AdSlot slotId="REPLACE_WITH_SLOT_ID_2" format="rectangle" className="my-4" />
```

Replace `REPLACE_WITH_SLOT_ID` values with real slot IDs from AdSense dashboard when available. Until then they render nothing (user is always null in dev and env var isn't set).

- [ ] **Step 8: Commit**

```bash
git add src/components/AdSlot.tsx src/components/__tests__/AdSlot.test.tsx index.html .env.example src/App.tsx
git commit -m "feat: AdSlot component — renders only for unauthenticated users when VITE_ADSENSE_ID set"
```

---

## Task 7: Final run and push

- [ ] **Backend lint + tests**

```bash
cd impostor-api && ruff check . && pytest tests/ -v
```

Expected: all pass, no lint errors

- [ ] **Frontend tests + build**

```bash
cd impostor-web && npm run test -- --run && npm run build
```

Expected: all pass, build succeeds

- [ ] **Push both**

```bash
cd impostor-api && git push
cd impostor-web && git push
```

Expected: CI green on both repos
