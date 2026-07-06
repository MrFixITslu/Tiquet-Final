import { AuthenticatedUser, Business } from "../types";

const API_BASE = "/api";
const CSRF_COOKIE_NAME = "tickit_csrf";

class ApiError extends Error {}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || null;
}

function isMutating(method?: string): boolean {
  return !!method && !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const method = options.method?.toUpperCase();
  const csrfToken = isMutating(method) ? getCookie(CSRF_COOKIE_NAME) : null;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(options.headers || {}),
      },
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

  refreshCsrf: () => request<{ csrfToken: string }>("/auth/csrf"),

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

  getBusinessData: <T>(businessId: string, key: string) =>
    request<{ data: T }>(`/businesses/${businessId}/data/${key}`),

  updateBusinessData: <T>(businessId: string, key: string, data: T) =>
    request<{ ok: true }>(`/businesses/${businessId}/data/${key}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    }),

  updateBusinessSettings: (businessId: string, settings: Partial<Business["settings"]>) =>
    request<{ business: Business }>(`/businesses/${businessId}/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export { ApiError };
