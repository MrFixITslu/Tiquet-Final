import { AuthenticatedUser, Business } from "../types";

const API_BASE = "/api";

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (HTTP ${response.status}).`);
  }
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string) =>
    request<{ user: AuthenticatedUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: AuthenticatedUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: AuthenticatedUser }>("/auth/me"),

  oauthGoogle: (accessToken: string) =>
    request<{ user: AuthenticatedUser }>("/auth/oauth/google", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),

  oauthFacebook: (accessToken: string) =>
    request<{ user: AuthenticatedUser }>("/auth/oauth/facebook", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),

  listBusinesses: () => request<{ businesses: Business[] }>("/businesses"),

  createBusiness: (payload: { name: string; email?: string; phone?: string; address?: string }) =>
    request<{ business: Business }>("/businesses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateBusinessSettings: (businessId: string, settings: Partial<Business["settings"]>) =>
    request<{ business: Business }>(`/businesses/${businessId}/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export { ApiError };
