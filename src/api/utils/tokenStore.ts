const ACCESS_KEY = 'rr_access_token';
const REFRESH_KEY = 'rr_refresh_token';

let generation = 0;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const tokenStore = {
  generation(): number {
    return generation;
  },

  getAccess(): string | null {
    return safeStorage()?.getItem(ACCESS_KEY) ?? null;
  },

  getRefresh(): string | null {
    return safeStorage()?.getItem(REFRESH_KEY) ?? null;
  },

  /** Store a new login/registration session and invalidate in-flight auth work. */
  set(accessToken: string, refreshToken: string): void {
    generation += 1;
    const storage = safeStorage();
    storage?.setItem(ACCESS_KEY, accessToken);
    storage?.setItem(REFRESH_KEY, refreshToken);
  },

  /** Refresh-token rotation: keep the same session generation. */
  replace(accessToken: string, refreshToken: string): void {
    const storage = safeStorage();
    storage?.setItem(ACCESS_KEY, accessToken);
    storage?.setItem(REFRESH_KEY, refreshToken);
  },

  clear(): void {
    generation += 1;
    const storage = safeStorage();
    storage?.removeItem(ACCESS_KEY);
    storage?.removeItem(REFRESH_KEY);
  },
};
