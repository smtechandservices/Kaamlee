// Send-back-after-login: when a page bounces a logged-out visitor to
// /login, it passes where they were as ?next=, and every login path
// (password, Google, email code, signup) returns them there afterwards.

const AUTH_PAGES = ['/login', '/signup'];

/** Only same-site paths — never "//evil.com", "https://…" or back to /login. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  const path = value.split(/[?#]/)[0];
  if (AUTH_PAGES.includes(path)) return null;
  return value;
}

/** /login?next=<current page> — use instead of a bare '/login' redirect. */
export function loginPath(): string {
  if (typeof window === 'undefined') return '/login';
  const next = safeNext(window.location.pathname + window.location.search);
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/** The ?next= on the current URL, if safe — read after a successful login. */
export function currentNext(): string | null {
  if (typeof window === 'undefined') return null;
  return safeNext(new URLSearchParams(window.location.search).get('next'));
}

/** Carry ?next= across the Log in ⇄ Sign up links. */
export function withNext(path: string): string {
  const next = currentNext();
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
