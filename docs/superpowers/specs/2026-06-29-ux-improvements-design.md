# Impostor UX Improvements — Design Spec

**Goal:** Mejorar la experiencia de juego en tres áreas: tokens estables sin login, selección de categorías desde el frontend, y flujo de ronda mejorado.

**Architecture:** El sistema sigue siendo completamente anónimo (sin login). El frontend persiste tokens de jugadores en `localStorage` para reutilizarlos entre rondas. El backend acepta tokens pre-existentes en el request de inicio de juego. El reveal endpoint siempre devuelve el resultado más reciente para un token dado.

**Tech Stack:** FastAPI (backend), React + TypeScript + Tailwind + shadcn/ui (frontend), localStorage (persistencia de tokens), polling cada 3s (detección de nueva ronda).

---

## 1. Tokens estables (sin login)

### Comportamiento actual
Para usuarios anónimos, cada `POST /api/game/start` crea nuevos `PlayerRecord` con tokens UUID frescos. Los links cambian en cada ronda.

### Comportamiento nuevo

**Primera ronda:**
1. `POST /api/game/start` con `players: [{name: "Marco"}, ...]` (sin token)
2. Backend crea `PlayerRecord` con token UUID nuevo por jugador
3. Frontend recibe `players: [{name: "Marco", token: "abc-123"}, ...]`
4. Frontend guarda en `localStorage` bajo la clave `impostor_player_tokens`: `[{name: "Marco", token: "abc-123"}, ...]`
5. QR codes generados con esos tokens

**Rondas siguientes (mismo grupo):**
1. Frontend lee `localStorage`, incluye tokens existentes en el request: `players: [{name: "Marco", token: "abc-123"}, ...]`
2. Backend recibe token existente → busca `PlayerRecord` existente por token → lo reutiliza
3. Crea nuevo `GamePlayerResult` para esa sesión con el mismo `player_id`
4. Devuelve los mismos tokens → mismos QR codes → jugadores no re-escanean

**Host cierra y vuelve:**
`localStorage` persiste → la pantalla de QRs se reconstruye al recargar (mismo estado, mismos links).

### Cambios en impostor-api

**`app/models.py`** — `PlayerIn` recibe token opcional:
```python
class PlayerIn(BaseModel):
    name: str
    telegram_id: str | None = None
    token: str | None = None  # si se provee, reutilizar PlayerRecord existente
```

**`app/models.py`** — `RevealResponse` incluye `session_id`:
```python
class RevealResponse(BaseModel):
    state: str
    player_name: str
    session_id: str        # nuevo — frontend lo compara para detectar nueva ronda
    is_impostor: bool | None
    category: str | None
```

**`app/game/engine.py`** — reutilizar `PlayerRecord` si llega token:
```python
# En GameEngine.run(), al crear players anónimos:
for p in players:
    if p.token:
        # buscar PlayerRecord existente por token
        existing = await db.execute(
            select(PlayerRecord).where(PlayerRecord.token == p.token)
        )
        player_record = existing.scalar_one_or_none()
        if player_record:
            db_players.append(player_record)
            continue
    # si no hay token o no se encontró, crear nuevo
    player_record = PlayerRecord(name=p.name, user_id=None, token=str(uuid4()))
    db.add(player_record)
    db_players.append(player_record)
```

**`app/routes/reveal.py`** — devolver el resultado más reciente para ese token:
```python
# ORDER BY game_sessions.created_at DESC, LIMIT 1
# Incluir session_id en la respuesta
```

### Cambios en impostor-web

**`src/hooks/useGame.ts`** — guardar tokens en localStorage después de `startGame`:
```typescript
// key: 'impostor_player_tokens'
// value: [{name: string, token: string}]
```

**`src/api/game.ts`** — leer tokens de localStorage y pasarlos en el request:
```typescript
const stored = getStoredTokens() // lee localStorage
const players = req.players.map(p => ({
  ...p,
  token: stored.find(s => s.name === p.name)?.token ?? undefined,
}))
```

---

## 2. Selección de categorías (paso 2 del wizard)

### Comportamiento

El paso 2 (`StepMode.tsx`) añade una sección colapsable al final, debajo de modo y dificultad.

**Estado colapsado (default):**
```
CATEGORÍAS  todas ▸
```
Si hay selección custom, muestra el conteo: `9 de 11 seleccionadas ▸`

**Estado expandido:**
- 11 chips toggleables (las categorías del sistema cargadas desde `GET /api/categories`)
- Seleccionadas: fondo `bg-primary/20`, borde `border-primary`
- Deseleccionadas: fondo `bg-card`, borde `border-border`, texto `text-muted-foreground`
- Input de texto + botón "Agregar" para categorías custom
- Categorías custom aparecen como chips verdes con botón ✕ para eliminar

**Comportamiento por defecto:** Todas las categorías del sistema seleccionadas. Si el usuario no expande la sección, se envía `categories: []` al API (el backend usa `DEFAULT_CATEGORIES`).

**Persistencia de categorías:** Las categorías seleccionadas se guardan en `localStorage` bajo `impostor_categories` junto con los tokens de jugadores, así el panel de "OTRA RONDA" las precarga.

### Cambios en impostor-web

**`src/components/wizard/StepMode.tsx`** — añadir sección colapsable:
- Cargar categorías con `getCategories()` al montar
- Estado local: `selectedCategories: string[]` (default: todas), `customCategories: string[]`, `expanded: boolean`
- Props nuevas: `categories: string[]`, `onCategoriesChange: (cats: string[]) => void`

**`src/components/wizard/WizardShell.tsx`** — pasar `categories` al engine:
- Estado nuevo: `categories: string[]` (default: `[]` = todas)
- Pasarlo a `StepMode` y al llamar `onStart`

---

## 3. Panel "OTRA RONDA"

### Comportamiento actual
"OTRA RONDA" resetea el wizard a Step 1 vacío.

### Comportamiento nuevo
Al presionar "OTRA RONDA", la pantalla de QRs es reemplazada por un panel inline con:

1. **JUGADORES** — chips con nombres (lectura). Link "+ agregar / editar" que expande una lista editable inline dentro del mismo panel (para cuando alguien se suma o se va). Si editan jugadores, se respetan los tokens guardados para los que ya estaban; jugadores nuevos reciben token fresco en el próximo `startGame`.

2. **MODO** — pills horizontales seleccionables (mismo look que StepMode)

3. **DIFICULTAD** — pills horizontales (Fácil / Difícil / Brutal)

4. **CATEGORÍAS** — colapsable, igual que en el wizard (precargado con la selección anterior)

5. **Botón "LANZAR RONDA"** — llama a `startGame` con los mismos jugadores (+tokens) y la nueva config

### Estado precargado
El panel abre con la misma config de la ronda anterior (modo, dificultad, categorías) para que sea un one-tap en el caso default.

### Cambios en impostor-web

**`src/components/GameInProgress.tsx`** — añadir estado `showRondaPanel: boolean`:
- Cuando `showRondaPanel=true`, renderiza el panel en lugar de (o sobre) la grilla de QRs
- El panel tiene su propia lógica de `startGame`

**`src/components/RondaPanel.tsx`** — nuevo componente:
- Recibe `players`, `currentMode`, `currentDifficulty`, `currentCategories`
- Emite `onLaunch({mode, difficulty, categories, players})`

---

## 4. Auto-detección de nueva ronda en RevealPage

### Comportamiento

El reveal page ya hace polling cada 3s. Con rondas múltiples, necesita detectar cuándo el `session_id` cambia.

**Estados de la pantalla del jugador:**
```
Sin ronda activa  →  "Esperando que empiece..."
Ronda activa      →  "Toca para revelar"  →  [rol revelado]
Nueva ronda       →  "Nueva ronda — toca para revelar"  (auto-transición)
```

La transición ocurre cuando el `session_id` en la respuesta es distinto al que el jugador ya reveló.

### Cambios en impostor-web

**`src/hooks/useReveal.ts`:**
- Continuar polling incluso después de `state=ready` (interval se mantiene activo)
- Exponer `sessionId` en el resultado
- Cuando `sessionId` cambia, resetear el estado de "tapped" a `false`

**`src/pages/RevealPage.tsx`:**
- Guardar el `sessionId` del resultado actual en `useRef`
- Cuando el hook reporta un `sessionId` distinto, resetear `tapped` state
- Mostrar texto diferente: "Nueva ronda — toca para revelar" vs primera vez

---

## 5. Quick-start desde localStorage

### Comportamiento

Cuando el usuario abre la app y hay jugadores guardados en localStorage:

```
┌─────────────────────────────────────┐
│ Continuar con Marco, Camila,        │
│ Felipe, Sara →                      │
│                          [Nuevo grupo] │
└─────────────────────────────────────┘
```

- Tap en el banner → carga el grupo guardado en Step 1 y avanza directo a Step 2
- Tap en "Nuevo grupo" → descarta el grupo guardado, empieza Step 1 vacío
- Si no hay datos en localStorage → no se muestra el banner

### Cambios en impostor-web

**`src/components/wizard/WizardShell.tsx`:**
- Al montar, leer `impostor_player_tokens` de localStorage
- Si existe, mostrar banner con los nombres
- "Continuar" → precargar jugadores en `usePlayers` y saltar a `step=2`
- "Nuevo grupo" → limpiar localStorage y proceder normalmente

---

## 6. Resumen de archivos a modificar

### impostor-api
| Archivo | Cambio |
|---|---|
| `app/models.py` | `PlayerIn.token` opcional; `RevealResponse.session_id` |
| `app/game/engine.py` | Reutilizar `PlayerRecord` si llega token pre-existente |
| `app/routes/reveal.py` | ORDER BY created_at DESC; devolver `session_id` |

### impostor-web
| Archivo | Cambio |
|---|---|
| `src/hooks/useGame.ts` | Guardar tokens en localStorage post-start |
| `src/api/game.ts` | Leer tokens de localStorage, incluirlos en request |
| `src/components/wizard/StepMode.tsx` | Sección colapsable de categorías |
| `src/components/wizard/WizardShell.tsx` | Estado de categories; quick-start banner; saltar a step 2 |
| `src/hooks/useReveal.ts` | Polling continuo; exponer session_id; detectar cambio |
| `src/pages/RevealPage.tsx` | Estado "nueva ronda"; texto diferenciado |
| `src/components/GameInProgress.tsx` | Panel "OTRA RONDA" en lugar de reset |
| `src/components/RondaPanel.tsx` | Nuevo componente — panel de configuración entre rondas |
