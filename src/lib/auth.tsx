import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export type User = {
  id: number;
  name: string;
  email: string;
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
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = "valerion.user";

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
      if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
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
      await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch {
      // ignore logout errors
    } finally {
      setUser(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(USER_KEY);
      }
      navigate("/", { replace: true });
      toast("Signed out", { className: "luxury-toast" });
    }
  }, [navigate]);

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
