import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export type User = {
  id: number;
  name: string;
  email: string | null;
  role: string;
  phone?: string;
  avatar?: string;
  address?: string;
};

const ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "BRAND_MANAGER",
  "INVENTORY_MANAGER",
  "ORDER_MANAGER",
  "MARKETING_MANAGER",
]);

export function hasAdminRole(user: Pick<User, "role"> | null | undefined) {
  return Boolean(user?.role && ADMIN_ROLES.has(user.role));
}

type AuthCtx = {
  user: User | null;
  hydrated: boolean;
  isLoggingOut: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  requestPhoneOtp: (phone: string, purpose: "login" | "register" | "link") => Promise<void>;
  signInWithPhone: (phone: string, otp: string) => Promise<void>;
  signUpWithPhone: (details: { name: string; email: string; password: string; phone: string; otp: string }) => Promise<void>;
  linkPhone: (phone: string, otp: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = "valerion.user";

const readCsrfCookie = () => {
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("csrf_token="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("csrf_token=".length));
  } catch {
    return cookie.slice("csrf_token=".length);
  }
};

const getCsrfToken = async () => {
  let token = readCsrfCookie();
  if (!token) {
    const response = await apiFetch("/api/auth/csrf");
    if (!response.ok) throw new Error("Unable to prepare phone authentication");
    token = readCsrfCookie();
  }
  if (!token) throw new Error("Unable to prepare phone authentication");
  return token;
};

const phoneAuthFetch = async (path: string, body: Record<string, string>) => {
  const csrfToken = await getCsrfToken();
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Unable to process phone authentication response");
    }
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data && typeof data.message === "string"
      ? data.message
      : "Phone authentication failed";
    throw new Error(message);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to process phone authentication response");
  }
  return data as Record<string, unknown>;
};

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    (candidate.email === null || typeof candidate.email === "string") &&
    typeof candidate.role === "string";
};

const getDevAdminCredentials = () => ({
  email: import.meta.env.VITE_DEV_ADMIN_EMAIL,
  password: import.meta.env.VITE_DEV_ADMIN_PASSWORD,
});

const authFetch = async (path: string, options: RequestInit = {}) => {
  let res
  try {
    res = await apiFetch(path, options)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Network error during authentication")
  }

  const text = await res.text().catch(() => "")
  let data: any = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || `Authentication failed (${res.status} ${res.statusText})`)
  }

  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const navigate = useNavigate();
  const isLoggingOutRef = useRef(false);

  const applyDevAdminSession = useCallback(async () => {
    if (typeof window === "undefined") return;

    const isLocalDevHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
    if (!import.meta.env.DEV || !isLocalDevHost) return;

    const { email, password } = getDevAdminCredentials();
    if (!email || !password) {
      setUser(null);
      window.localStorage.removeItem(USER_KEY);
      setHydrated(true);
      return;
    }

    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (data?.user) {
        setUser(data.user);
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setHydrated(true);
        return;
      }
    } catch {
    }

    setUser(null);
    window.localStorage.removeItem(USER_KEY);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null;
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
    const restoreSession = async () => {
      const isLocalDevHost = typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
      const isDevBypassRequested = typeof window !== "undefined" && window.location.search.includes("dev_admin=1");

      try {
        if (import.meta.env.DEV && isLocalDevHost && isDevBypassRequested) {
          await applyDevAdminSession();
          return;
        }
      } catch (e) {
        // ignore
      }

      try {
        const profile = await authFetch("/api/auth/profile", {
        });
        setUser(profile.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isLocalDevHost && /401|403|Unauthorized|Authentication failed/i.test(message)) {
          await applyDevAdminSession();
          return;
        }
        setUser(null);
        window.localStorage.removeItem(USER_KEY);
      } finally {
        setHydrated(true);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    if (user) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }

    const pathname = window.location.pathname;
    if (!user) {
      const isLoggingOut = isLoggingOutRef.current;
      isLoggingOutRef.current = false;
      if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !isLoggingOut) {
        navigate("/", { replace: true });
      }
      return;
    }

    if (hasAdminRole(user)) {
      const isAdminRoute = pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/");
      if (!isAdminRoute) {
        navigate("/admin/dashboard", { replace: true });
      } else if (pathname === "/admin" || pathname === "/admin/") {
        navigate("/admin/dashboard", { replace: true });
      }
      return;
    }

    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      navigate("/admin/login", { replace: true });
    }
  }, [user, hydrated, navigate]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      }
      toast.success("Signed in successfully", {
        description: `Welcome back, ${data.user.name}`,
        className: "luxury-toast",
      });
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const data = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (isUser(data.user)) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      }
      toast.success("Account request submitted", {
        description: data.message || "If the details are eligible, the account request was processed.",
        className: "luxury-toast",
      });
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const requestPhoneOtp = useCallback(async (phone: string, purpose: "login" | "register" | "link") => {
    const path = purpose === "link" ? "/api/auth/phone/link/send" : `/api/auth/phone/${purpose}/send`;
    try {
      await phoneAuthFetch(path, { phone });
      toast.success("Verification code sent", { className: "luxury-toast" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send verification code";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const signInWithPhone = useCallback(async (phone: string, otp: string) => {
    try {
      const data = await phoneAuthFetch("/api/auth/phone/login/verify", { phone, otp });
      if (!isUser(data.user)) throw new Error("Unable to process phone authentication response");
      setUser(data.user);
      if (typeof window !== "undefined") window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      toast.success("Signed in successfully", {
        description: `Welcome back, ${data.user.name}`,
        className: "luxury-toast",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const signUpWithPhone = useCallback(async ({ name, email, password, phone, otp }: {
    name: string;
    email: string;
    password: string;
    phone: string;
    otp: string;
  }) => {
    try {
      const data = await phoneAuthFetch("/api/auth/phone/register/verify", { name, email, password, phone, otp });
      if (!isUser(data.user)) throw new Error("Unable to process phone authentication response");
      setUser(data.user);
      if (typeof window !== "undefined") window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      toast.success("Account created", { description: `Welcome, ${data.user.name}`, className: "luxury-toast" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const linkPhone = useCallback(async (phone: string, otp: string) => {
    try {
      await phoneAuthFetch("/api/auth/phone/link/verify", { phone, otp });
      toast.success("Phone linked successfully", { className: "luxury-toast" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to link phone";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch {
      // ignore logout errors
    } finally {
      isLoggingOutRef.current = true;
      setUser(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
      }
      navigate("/admin/login", { replace: true });
      toast("Signed out", { className: "luxury-toast" });
    }
  }, [navigate]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo(
    () => ({
      user,
      hydrated,
      isLoggingOut: isLoggingOutRef.current,
      signIn,
      signUp,
      requestPhoneOtp,
      signInWithPhone,
      signUpWithPhone,
      linkPhone,
      signOut,
      updateUser,
    }),
    [user, hydrated, signIn, signUp, requestPhoneOtp, signInWithPhone, signUpWithPhone, linkPhone, signOut, updateUser]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
