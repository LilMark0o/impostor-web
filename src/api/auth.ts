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
