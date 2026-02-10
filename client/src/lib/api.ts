/**
 * Centralized API configuration for the Antigravity application.
 * Follows Infrastructure & Database Migration Guidelines Section 6.2.
 */

export const getApiUrl = (): string | undefined => {
    // Priority 1: Environment variable (standard for Vite)
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return envUrl;

    // Priority 2: Alternative name sometimes used in production migrations
    const altEnvUrl = import.meta.env.NEXT_PUBLIC_API_BASE_URL;
    if (altEnvUrl) return altEnvUrl;

    // Priority 3: Localhost fallback for development only
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
            return 'http://localhost:4000';
        }
    }

    return undefined;
};

export const API_URL = getApiUrl();

if (typeof window !== 'undefined') {
    console.log('🔌 Antigravity API URL:', API_URL);
}

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
export const AUTH_ROLE_KEY = 'auth_role';
export const AUTH_SESSION_EXPIRED_EVENT = 'designhub:auth:session-expired';

let refreshTokenPromise: Promise<string | null> | null = null;

export const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

const isAuthRoute = (url: string) =>
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout');

const resolveRequestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url || '';
};

const clearAuthSession = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_ROLE_KEY);
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
};

const refreshAccessToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }

    refreshTokenPromise = (async () => {
        const baseUrl = API_URL || window.location.origin;
        try {
            const response = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) {
                return null;
            }
            const payload = await response.json().catch(() => null);
            const token =
                payload && typeof payload.token === 'string' && payload.token.trim()
                    ? payload.token.trim()
                    : '';
            if (!token) {
                return null;
            }
            window.localStorage.setItem(AUTH_TOKEN_KEY, token);
            return token;
        } catch {
            return null;
        } finally {
            refreshTokenPromise = null;
        }
    })();

    return refreshTokenPromise;
};

const requestWithToken = async (
    input: RequestInfo | URL,
    init: RequestInit,
    token?: string | null
) => {
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
};

export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const requestUrl = resolveRequestUrl(input);
    const initialToken = getAuthToken();
    const firstResponse = await requestWithToken(input, init, initialToken);
    if (firstResponse.status !== 401 || isAuthRoute(requestUrl)) {
        return firstResponse;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
        clearAuthSession();
        return firstResponse;
    }

    const retryResponse = await requestWithToken(input, init, refreshedToken);
    if (retryResponse.status === 401) {
        clearAuthSession();
    }
    return retryResponse;
};
