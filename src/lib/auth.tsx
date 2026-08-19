import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string;
  address?: string;
};

type AuthCtx = {
  user: User | null;
  hydrated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = "valerion.user";
const TOKEN_KEY = "valerion.token";

const getDevAdminCredentials = () => ({
  email: import.meta.env.VITE_DEV_ADMIN_EMAIL || "admin@valerion.test",
  password: import.meta.env.VITE_DEV_ADMIN_PASSWORD || "SecureAdmin123",
});

const authFetch = async (path: string, options: RequestInit = {}) => {
  console.debug("Auth request:", { path, method: options.method || "GET", headers: options.headers, body: options.body });
  let res
  try {
    res = await fetch(path, options)
  } catch (error) {
    console.error("Auth request network error:", { path, error })
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
    console.error("Auth request failed:", { path, status: res.status, statusText: res.statusText, body: data })
    throw new Error(data?.message || `Authentication failed (${res.status} ${res.statusText})`)
  }

  console.debug("Auth request success:", { path, status: res.status, body: data })
  return data
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const navigate = useNavigate();

  const applyDevAdminSession = useCallback(async () => {
    if (typeof window === "undefined") return;

    const isLocalDevHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
    if (!isLocalDevHost) return;

    const { email, password } = getDevAdminCredentials();
    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (data?.user && data?.token) {
        setUser(data.user);
        setToken(data.token);
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        window.localStorage.setItem(TOKEN_KEY, data.token);
        setHydrated(true);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Dev admin login failed:", message);
    }

    setUser(null);
    setToken(null);
    window.localStorage.removeItem(USER_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null;
    const storedToken = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
    // debug
    // eslint-disable-next-line no-console
    console.debug("AuthProvider:init", { storedUser: !!storedUser, storedToken: !!storedToken });
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }
    if (storedToken) {
      setToken(storedToken);
    }

    const restoreSession = async () => {
      const isLocalDevHost = typeof window !== "undefined" && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
      const isDevBypassRequested = typeof window !== "undefined" && window.location.search.includes("dev_admin=1");

      try {
        if (isLocalDevHost && (isDevBypassRequested || !storedToken)) {
          console.debug("AuthProvider: local dev admin fallback active");
          await applyDevAdminSession();
          return;
        }
      } catch (e) {
        // ignore
      }
      if (!storedToken) {
        // eslint-disable-next-line no-console
        console.debug("AuthProvider: no stored token, skipping profile fetch");
        setHydrated(true);
        return;
      }

      try {
        // eslint-disable-next-line no-console
        console.debug("AuthProvider: attempting profile restore");
        const profile = await authFetch("/api/auth/profile", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        // eslint-disable-next-line no-console
        console.debug("AuthProvider: profile restored", profile);
        setUser(profile.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isLocalDevHost && /401|403|Unauthorized|Authentication failed/i.test(message)) {
          console.debug("AuthProvider: falling back to local dev admin session after auth failure");
          await applyDevAdminSession();
          return;
        }
        console.warn("Auth restore failed:", message);
        setUser(null);
        setToken(null);
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        // eslint-disable-next-line no-console
        console.debug("AuthProvider: hydrated true");
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

    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }

    const pathname = window.location.pathname;
    if (!user) {
      if (pathname.startsWith("/admin")) {
        navigate("/", { replace: true });
      }
      return;
    }

    if (user.role === "ADMIN") {
      const isAdminRoute = pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/");
      if (!isAdminRoute) {
        navigate("/admin/dashboard", { replace: true });
      } else if (pathname === "/admin" || pathname === "/admin/") {
        navigate("/admin/dashboard", { replace: true });
      }
      return;
    }

    if (pathname.startsWith("/admin")) {
      navigate("/", { replace: true });
    }
  }, [user, token, hydrated, navigate]);

  const signIn = useCallback(async (email: string, password: string) => {
    console.debug("signIn called", { email, hasPassword: Boolean(password) });
    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      console.debug("signIn response", { user: data.user, tokenExists: Boolean(data.token) });
      setUser(data.user);
      setToken(data.token);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        window.localStorage.setItem(TOKEN_KEY, data.token);
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
      setUser(data.user);
      setToken(data.token);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        window.localStorage.setItem(TOKEN_KEY, data.token);
      }
      toast.success("Account created", {
        description: `Welcome, ${data.user.name}`,
        className: "luxury-toast",
      });
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account";
      toast.error(message, { className: "luxury-toast" });
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      // ignore logout errors
    } finally {
      setUser(null);
      setToken(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      }
      navigate("/", { replace: true });
      toast("Signed out", { className: "luxury-toast" });
    }
  }, [navigate, token]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo(
    () => ({ user, hydrated, signIn, signUp, signOut, updateUser }),
    [user, hydrated, signIn, signUp, signOut, updateUser]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
