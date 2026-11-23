// API client for Nexus ERP frontend

const rawApiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined);

// Use relative '/api' when pointing to localhost so requests route through
// Vite's reverse-proxy across port-forwards, public tunnels, and LAN devices.
const API_BASE_URL =
    rawApiUrl && !rawApiUrl.includes('localhost:3000')
        ? rawApiUrl
        : '/api';

const TOKEN_STORAGE_KEY = 'nexus_erp_token';
const USER_STORAGE_KEY = 'nexus_erp_user';

let inMemoryToken: string | null = null;
const unauthorizedListeners = new Set<() => void>();

export function getStoredToken(): string | null {
    if (inMemoryToken) return inMemoryToken;
    try {
        const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) {
            inMemoryToken = stored;
            return stored;
        }
    } catch {
        // sessionStorage might be restricted
    }
    return null;
}

export function setStoredToken(token: string | null) {
    inMemoryToken = token;
    try {
        if (token) {
            sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        } else {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            sessionStorage.removeItem(USER_STORAGE_KEY);
        }
    } catch {
        // ignore storage errors
    }
}

export function onUnauthorized(callback: () => void): () => void {
    unauthorizedListeners.add(callback);
    return () => {
        unauthorizedListeners.delete(callback);
    };
}

function notifyUnauthorized() {
    setStoredToken(null);
    unauthorizedListeners.forEach((callback) => {
        try {
            callback();
        } catch (err) {
            console.error('Error executing unauthorized listener', err);
        }
    });
}

export class ApiError extends Error {
    statusCode: number;
    errorType?: string;
    details?: string[] | string;

    constructor(statusCode: number, message: string, errorType?: string, details?: string[] | string) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.details = details;
    }
}

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<T> {
    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    const token = getStoredToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    let response: Response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
        });
    } catch {
        throw new ApiError(
            0,
            `Network error: Unable to reach backend server at ${API_BASE_URL}. Ensure backend is running.`,
            'NetworkError',
        );
    }

    if (response.status === 401) {
        notifyUnauthorized();
        let message = 'Your session has expired. Please log in again.';
        try {
            const body = await response.json();
            if (body?.message) {
                message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
            }
        } catch {
            // keep default message
        }
        throw new ApiError(401, message, 'Unauthorized');
    }

    if (!response.ok) {
        let errorMsg = `Request failed with status ${response.status}`;
        let errorType = response.statusText;
        let details: string[] | string | undefined;

        try {
            const body = await response.json();
            if (body) {
                errorType = body.error || errorType;
                if (body.message) {
                    if (Array.isArray(body.message)) {
                        details = body.message;
                        errorMsg = body.message.join('. ');
                    } else {
                        errorMsg = body.message;
                        details = body.message;
                    }
                }
            }
        } catch {
            // fallback to statusText
            errorMsg = response.statusText || errorMsg;
        }

        // Specific handling for standard error codes
        if (response.status === 400) {
            errorMsg = errorMsg || 'Validation error or invalid request parameters.';
        } else if (response.status === 403) {
            errorMsg = errorMsg || 'Access denied: You do not have permission for this resource.';
        } else if (response.status === 404) {
            errorMsg = errorMsg || 'Requested resource was not found.';
        } else if (response.status === 409) {
            errorMsg = errorMsg || 'Conflict: Record already exists or violates unique constraint.';
        }

        throw new ApiError(response.status, errorMsg, errorType, details);
    }

    // 204 No Content
    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

