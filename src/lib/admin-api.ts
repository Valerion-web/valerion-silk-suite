import { getAdminStoreSlug } from "@/lib/admin-context";
import { apiFetch } from "@/lib/api";

export function adminApiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-store-slug", getAdminStoreSlug());
  return apiFetch(input, { ...init, headers });
}
