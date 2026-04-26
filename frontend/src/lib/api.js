const API_URL = 'http://127.0.0.1:8000/api';

export const fetchWithAuth = async (endpoint, options = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // If body is FormData (for files), we shouldn't set Content-Type as application/json
    // The browser will automatically set Content-Type with the boundary if we delete it
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);

    // Handle 401 Unauthorized (token expired)
    if (response.status === 401 && endpoint !== '/auth/login/') {
        // In a real app, implement refresh token logic here.
        // For now, we'll just clear the token and redirect to login if we can't fetch
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.href = '/login';
        }
    }

    return response;
};

export const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
        localStorage.setItem('access_token', data.access);
        localStorage.setItem('refresh_token', data.refresh);
        return true;
    }
    throw new Error(data.detail || data.error || 'Login failed');
};

export const register = async (userData) => {
    const res = await fetch(`${API_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
    }
    return true;
};
