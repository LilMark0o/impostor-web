const TOKENS_KEY = 'impostor_player_tokens'
const CATEGORIES_KEY = 'impostor_categories'
const SESSION_WORDS_KEY = 'impostor_session_words'

export interface StoredToken {
  name: string
  token: string
}

export function getStoredTokens(): StoredToken[] {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveTokens(players: { name: string; token: string }[]): void {
  const filtered = players.filter((p) => p.token)
  localStorage.setItem(TOKENS_KEY, JSON.stringify(filtered))
}

export function clearStoredTokens(): void {
  localStorage.removeItem(TOKENS_KEY)
}

export function getStoredCategories(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CATEGORIES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveCategories(categories: string[]): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories))
}

export function clearStoredCategories(): void {
  localStorage.removeItem(CATEGORIES_KEY)
}

export function getSessionWords(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_WORDS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function addSessionWord(word: string): void {
  if (!word) return
  const current = getSessionWords()
  if (!current.includes(word)) {
    sessionStorage.setItem(SESSION_WORDS_KEY, JSON.stringify([...current, word]))
  }
}

export function clearSessionWords(): void {
  sessionStorage.removeItem(SESSION_WORDS_KEY)
}
