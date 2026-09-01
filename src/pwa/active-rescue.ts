const ACTIVE_RESCUE_KEY = 'rr_active_rescue';

/** Call from live tracking / active job screens to defer forced PWA updates. */
export function setActiveRescueFlag(active: boolean): void {
  try {
    if (active) localStorage.setItem(ACTIVE_RESCUE_KEY, '1');
    else localStorage.removeItem(ACTIVE_RESCUE_KEY);
  } catch {
    // ignore
  }
}

export function isActiveRescueFlagSet(): boolean {
  try {
    return localStorage.getItem(ACTIVE_RESCUE_KEY) === '1';
  } catch {
    return false;
  }
}
