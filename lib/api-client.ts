/**
 * Authenticated fetch wrapper that includes JWT token AND X-Company-Id header.
 * All API calls automatically include the active company context.
 * Default timeout: 60 seconds (overridable via options.signal)
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}, timeoutMs = 60_000) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const activeCompanyId = typeof window !== 'undefined' ? localStorage.getItem('activeCompanyId') : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {}),
    };

    // Abort controller for timeout — use caller's signal if provided
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If caller passed their own signal, wire it up
    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
        const res = await fetch(url, { ...options, headers, signal: controller.signal });

        if (res.status === 401 && typeof window !== 'undefined') {
            // Token expired or invalid - redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('activeCompanyId');
            localStorage.removeItem('companies');
            window.location.href = '/auth/login';
        }

        // Safe JSON wrapper to avoid crashing on HTML responses (e.g. 404/500 errors)
        const originalJson = res.json.bind(res);
        res.json = async () => {
            try {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch {
                    return { success: false, error: `Server returned non-JSON response (${res.status} ${res.statusText})` };
                }
            } catch (err: any) {
                return { success: false, error: err.message || 'Failed to read response' };
            }
        };

        return res;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000}s — please try again.`);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Helper to get the current active company ID from localStorage.
 * Useful in server actions or non-React contexts.
 */
export function getActiveCompanyId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('activeCompanyId');
}
