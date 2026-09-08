import { tokenStore } from '../utils/tokenStore';

const AUTH_SCOPED_KEYS = ['rr_active_rescue'] as const;

/**
 * Clears every client-side credential used after login.
 * Does not remove pending-email helpers used on the verify-email screen.
 */
export function clearAuthState(): void {
  tokenStore.clear();
  try {
    for (const key of AUTH_SCOPED_KEYS) {
      localStorage.removeItem(key);
    }
    sessionStorage.removeItem('rr_access_token');
    sessionStorage.removeItem('rr_refresh_token');
  } catch {
    // Private browsing can throw on storage access.
  }
}
