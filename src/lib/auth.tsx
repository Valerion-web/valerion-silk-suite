import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type User = {
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: string;
};

type AuthCtx = {
  user: User | null;
  hydrated: boolean;
  signIn: (email: string, _pass: string) => void;
  signUp: (name: string, email: string, _pass: string) => void;
  signOut: () => void;
  updateUser: (patch: Partial<User>) => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "valerion.user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setUser(JSON.parse(v));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
    else localStorage.removeItem(KEY);
  }, [user, hydrated]);

  const signIn = useCallback((email: string, _p: string) => {
    const name = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    setUser({ name, email, phone: "", address: "" });
    toast.success("Welcome back", { description: name, className: "luxury-toast" });
  }, []);

  const signUp = useCallback((name: string, email: string, _p: string) => {
    setUser({ name, email, phone: "", address: "" });
    toast.success("Account created", { description: `Welcome, ${name}`, className: "luxury-toast" });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    toast("Signed out", { className: "luxury-toast" });
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo(() => ({ user, hydrated, signIn, signUp, signOut, updateUser }), [user, hydrated, signIn, signUp, signOut, updateUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
