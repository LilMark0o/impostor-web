import "@testing-library/jest-dom"

// Node 26 / jsdom 29 does not expose localStorage on window by default.
// Provide a simple in-memory shim so tests can use it normally.
if (typeof window !== "undefined" && typeof window.localStorage === "undefined") {
  const store: Record<string, string> = {}
  const localStorageMock: Storage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
    removeItem: (key) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (index) => Object.keys(store)[index] ?? null,
  }
  Object.defineProperty(window, "localStorage", { value: localStorageMock })
}
