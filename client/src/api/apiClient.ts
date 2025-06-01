const API_URL = import.meta.env.VITE_API_URL || "";

export interface ApiError {
  error: string;
  status?: number;
}

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
};

// Locally http cookies may not work, so we use the localStorage
(function handleLocalDevToken() {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("auth_token", token);
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
