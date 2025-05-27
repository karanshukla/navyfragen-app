// Base API client configuration
const API_URL = import.meta.env.VITE_API_URL || "";

// Error types
export interface ApiError {
  error: string;
  status?: number;
}

/**
 * Base API client for making HTTP requests
 * Automatically sets credentials and handles JSON responses
 */
function isLocalDev() {
  return (
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    !import.meta.env.PROD
  );
}

function getLocalToken() {
  if (isLocalDev()) {
    return localStorage.getItem("auth_token");
  }
  return null;
}

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const localToken = getLocalToken();
    if (localToken) {
      headers["Authorization"] = `Bearer ${localToken}`;
      console.debug("[apiClient] Sending Bearer token from localStorage");
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
      credentials: "include",
      headers,
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },

  post: async <T, D = any>(endpoint: string, data?: D): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const localToken = getLocalToken();
    if (localToken) {
      headers["Authorization"] = `Bearer ${localToken}`;
      console.debug("[apiClient] Sending Bearer token from localStorage");
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },

  delete: async <T, D = any>(endpoint: string, data?: D): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const localToken = getLocalToken();
    if (localToken) {
      headers["Authorization"] = `Bearer ${localToken}`;
      console.debug("[apiClient] Sending Bearer token from localStorage");
    }
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      credentials: "include",
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<T>;
  },

  /**
   * Set the auth_token cookie by posting the token to the backend
   * Used for local dev after OAuth redirect
   */
  setCookie: async (token: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/set-cookie`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw { ...error, status: response.status } as ApiError;
    }
    return response.json() as Promise<{ success: boolean }>;
  },
};

// Local dev: extract token from URL and store in localStorage, then clean up URL
(function handleLocalDevToken() {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
      // Debug log
      console.debug("[apiClient] Stored auth_token from URL param");
      params.delete("token");
      const newSearch = params.toString();
      const newUrl =
        window.location.pathname +
        (newSearch ? `?${newSearch}` : "") +
        window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }
})();
