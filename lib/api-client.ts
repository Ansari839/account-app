/**
 * Authenticated fetch wrapper that includes JWT token AND X-Company-Id header.
 * All API calls automatically include the active company context.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const activeCompanyId = typeof window !== 'undefined' ? localStorage.getItem('activeCompanyId') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {}),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && typeof window !== 'undefined') {
        // Token expired or invalid - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('activeCompanyId');
        localStorage.removeItem('companies');
        window.location.href = '/auth/login';
    }

    return res;
}

/**
 * Helper to get the current active company ID from localStorage.
 * Useful in server actions or non-React contexts.
 */
export function getActiveCompanyId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('activeCompanyId');
}
