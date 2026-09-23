// Shared localStorage helpers for the employer session — mirrors the
// admin_token pattern in frontend-admin, but scoped to an employer account
// rather than a superuser.
const TOKEN_KEY = 'employer_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Token ${token}` };
}
