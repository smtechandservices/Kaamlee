// Persists an in-progress admin action (currently: the "run scraper script"
// live view — logs/results/progress) to sessionStorage, so navigating to
// another admin page and back (or a hard reload) in the *same tab* doesn't
// lose it. Deliberately sessionStorage, not localStorage: a run belongs to
// whichever tab started it, and two tabs both resuming polling for the same
// run would race to drain the same server-side log buffer (see
// RunScriptStatusView / _RunRegistry in backend/api/views.py). Cross-tab
// visibility of "what's running" is already handled correctly by the
// DB-backed Active Runs card, which doesn't need this.
export function getSession<T = unknown>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function setSession(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage disabled (e.g. private browsing) — the live
    // view just won't survive a nav/reload this time, nothing to recover.
  }
}

export function clearSession(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
