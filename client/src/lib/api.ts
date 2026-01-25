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

export const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

export const authFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers || {});
    const token = getAuthToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
};
