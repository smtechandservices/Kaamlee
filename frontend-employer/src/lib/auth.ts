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

// Logout proper: deletes the token on the server (so a copied token stops
// working immediately), then forgets it locally either way.
export function logout(): void {
  const token = getToken();
  if (token) {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logout/`, {
      method: 'POST',
      headers: authHeaders(token),
      keepalive: true,
    }).catch(() => {});
  }
  clearToken();
}

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Token ${token}` };
}
