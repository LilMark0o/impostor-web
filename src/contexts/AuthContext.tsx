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

export const AuthContext = createContext<AuthContextValue | null>(null)

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
