const API_URL = import.meta.env.VITE_API_URL || "";

export interface ApiError {
  error: string;
  status?: number;
}

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
