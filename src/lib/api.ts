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
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        return 'http://localhost:4000';
    }

    return undefined;
};

export const API_URL = getApiUrl();
