const API_URL = import.meta.env.VITE_API_URL || "";

export interface ApiError {
  error: string;
  /** The server's untranslated English fallback for `error`, when it sent one. */
  message?: string;
  status?: number;
}

/**
 * What `apiClient` throws when a non-OK response carries no JSON body.
 * `error` holds a machine code everywhere else, and `resolveApiErrorMessage`
 * renders the localized generic string for any value it does not recognise,
 * so this one only ever reaches a log.
 */
const UNPARSEABLE_ERROR_BODY = { error: "Unknown error" /* i18n-allow */ };

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => UNPARSEABLE_ERROR_BODY);
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },

  post: async <T, D = any>(endpoint: string, data?: D): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => UNPARSEABLE_ERROR_BODY);
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },

  delete: async <T, D = any>(endpoint: string, data?: D): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      credentials: "include",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => UNPARSEABLE_ERROR_BODY);
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },
};
