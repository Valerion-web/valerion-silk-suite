import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type User = {
  id: number;
  name: string;
  email: string;
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

const authFetch = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Authentication failed");
  }
  return data;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem(USER_KEY) : null;
    const storedToken = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
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
      if (!storedToken) {
        setHydrated(true);
        return;
      }

      try {
        const profile = await authFetch("/api/auth/profile", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        setUser(profile.user);
      } catch (error) {
        console.warn("Auth restore failed:", error instanceof Error ? error.message : error);
        setUser(null);
        setToken(null);
        window.localStorage.removeItem(USER_KEY);
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        setHydrated(true);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

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
  }, [user, token, hydrated]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const data = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setToken(data.token);
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

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      const data = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      setUser(data.user);
      setToken(data.token);
      toast.success("Account created", {
        description: `Welcome, ${data.user.name}`,
        className: "luxury-toast",
      });
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
      toast("Signed out", { className: "luxury-toast" });
    }
  }, [token]);

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
