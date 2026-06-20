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
    localStorage.clear()
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
