/**
 * Simple wrapper for fetch that includes the JWT token from localStorage.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && typeof window !== 'undefined') {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn');
        window.location.href = '/auth/login';
    }

    return res;
}
