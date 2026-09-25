const storeSlug = String(import.meta.env.VITE_STORE_SLUG || "haston").trim().toLowerCase();
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const assetBaseUrl = (apiBaseUrl || "https://api.haston.in").replace(/\/api$/i, "");
const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function resolveApiUrl(input: RequestInfo | URL) {
  if (typeof input !== "string") return input;
  if (input.startsWith("/api")) return apiBaseUrl ? `${apiBaseUrl}${input.slice("/api".length)}` : input;
  if (input.startsWith("/uploads")) return `${assetBaseUrl}${input}`;
  return input;
}

export function resolveAssetUrl(input: string) {
  return resolveApiUrl(input) as string;
}

function getCsrfToken() {
  if (typeof document === "undefined") return null;

  const csrfCookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("csrf_token="));

  if (!csrfCookie) return null;

  const value = csrfCookie.slice("csrf_token=".length);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function apiHeaders(headers?: HeadersInit, method?: string) {
  const result = new Headers(headers);
  if (!result.has("x-store-slug")) result.set("x-store-slug", storeSlug);
  if (stateChangingMethods.has(String(method || "GET").toUpperCase()) && !result.has("X-CSRF-Token")) {
    const csrfToken = getCsrfToken();
    if (csrfToken) result.set("X-CSRF-Token", csrfToken);
  }
  return result;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(resolveApiUrl(input), { ...init, credentials: "include", headers: apiHeaders(init.headers, init.method) });
}