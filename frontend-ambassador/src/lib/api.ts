const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.kaamlee.in';
const TOKEN_KEY = 'ambassador_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function ambassadorFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Token ${token}`);
  return fetch(`${API_URL}/ambassador${path}`, { ...options, headers });
}

// Same as ambassadorFetch but hits the API root directly rather than the
// /ambassador prefix — for apps like `events` that aren't mounted under it.
export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Token ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
