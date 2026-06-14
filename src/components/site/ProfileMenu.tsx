import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  User as UserIcon,
  Package,
  Heart,
  Clock,
  CreditCard,
  Settings,
  MapPin,
  LogOut,
  X,
  Mail,
  Phone,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

export function ProfileMenu({ onDark }: { onDark: boolean }) {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const { user, signOut } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        className={`relative transition-all hover:text-gold hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] ${onDark ? "text-frost" : "text-foreground"}`}
      >
        <UserIcon className="h-[18px] w-[18px]" />
        {user && (
          <span className="absolute -bottom-1 -right-1 h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_rgba(212,175,55,0.8)]" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+18px)] z-50 w-[340px] rounded-md overflow-hidden"
            style={{
              background: "linear-gradient(160deg, oklch(0.18 0.05 258) 0%, oklch(0.13 0.05 258) 100%)",
              border: "1px solid oklch(0.78 0.13 85 / 0.25)",
              boxShadow: "0 30px 80px -20px oklch(0 0 0 / 0.6), 0 0 40px oklch(0.78 0.13 85 / 0.08)",
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

            {user ? (
              <SignedIn user={user} onClose={() => setOpen(false)} onSignOut={signOut} />
            ) : (
              <SignedOut
                onSignIn={() => { setMode("signin"); setAuthOpen(true); setOpen(false); }}
                onSignUp={() => { setMode("signup"); setAuthOpen(true); setOpen(false); }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal open={authOpen} mode={mode} setMode={setMode} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

function SignedIn({ user, onClose, onSignOut }: { user: { name: string; email: string; phone?: string; avatar?: string; address?: string }; onClose: () => void; onSignOut: () => void }) {
  const initials = user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const items: { to: string; label: string; icon: typeof Package; internal?: boolean }[] = [
    { to: "/account/orders", label: "My Orders", icon: Package },
    { to: "/wishlist", label: "Wishlist", icon: Heart, internal: true },
    { to: "/account/recent", label: "Recently Viewed", icon: Clock },
    { to: "/account/addresses", label: "Saved Addresses", icon: MapPin },
    { to: "/account/payments", label: "Payment Methods", icon: CreditCard },
    { to: "/account/settings", label: "Account Settings", icon: Settings },
  ];

  return (
    <div className="text-frost">
      <div className="flex items-start gap-3 px-5 pt-6 pb-5 border-b border-gold/15">
        <div className="h-12 w-12 shrink-0 rounded-full bg-gradient-gold flex items-center justify-center text-midnight font-display text-base tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.3)]">
          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" /> : initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight truncate">{user.name}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-frost/60 truncate">
            <Mail className="h-3 w-3 text-gold/70 shrink-0" /> <span className="truncate">{user.email}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-frost/60">
            <Phone className="h-3 w-3 text-gold/70 shrink-0" /> {user.phone || <span className="italic text-frost/40">Add phone</span>}
          </div>
        </div>
      </div>

      <nav className="py-2">
        {items.map((it) => {
          const cls = "group flex items-center gap-3 px-5 py-2.5 text-[12px] tracking-[0.14em] uppercase text-frost/80 hover:text-gold transition-colors";
          const inner = (
            <>
              <it.icon className="h-[14px] w-[14px] text-gold/60 group-hover:text-gold transition-colors" />
              <span className="flex-1">{it.label}</span>
              <span className="opacity-0 group-hover:opacity-100 text-gold transition-opacity">→</span>
            </>
          );
          return it.internal ? (
            <Link key={it.to} to={it.to} onClick={onClose} className={cls}>{inner}</Link>
          ) : (
            <a key={it.to} href={it.to} onClick={onClose} className={cls}>{inner}</a>
          );
        })}
      </nav>

      <div className="border-t border-gold/15 px-3 py-3">
        <button
          onClick={() => { onSignOut(); onClose(); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] tracking-[0.22em] uppercase text-frost/80 hover:text-gold hover:bg-gold/5 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );
}

function SignedOut({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  return (
    <div className="px-5 py-7 text-frost text-center">
      <div className="mx-auto h-12 w-12 rounded-full border border-gold/40 flex items-center justify-center mb-4">
        <UserIcon className="h-5 w-5 text-gold" />
      </div>
      <div className="font-display text-lg">Welcome to Valerion</div>
      <p className="mt-1.5 text-[11px] tracking-[0.18em] uppercase text-frost/50">Members enjoy exclusive access</p>

      <div className="mt-6 space-y-2.5">
        <button
          onClick={onSignIn}
          className="w-full bg-gradient-gold text-midnight py-3 text-[11px] tracking-[0.22em] uppercase font-medium hover:shadow-[0_0_24px_rgba(212,175,55,0.5)] transition-all"
        >
          Sign In
        </button>
        <button
          onClick={onSignUp}
          className="w-full border border-gold/40 text-frost py-3 text-[11px] tracking-[0.22em] uppercase hover:border-gold hover:text-gold transition-all"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}

function AuthModal({ open, onClose, mode, setMode }: { open: boolean; onClose: () => void; mode: "signin" | "signup"; setMode: (m: "signin" | "signup") => void }) {
  const { signIn, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Trim whitespace and normalize email (lowercase)
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPass = pass.trim();
      const trimmedName = name.trim();

      if (mode === "signin") {
        await signIn(trimmedEmail, trimmedPass);
      } else {
        await signUp(trimmedName || trimmedEmail.split("@")[0], trimmedEmail, trimmedPass);
      }
      setName("");
      setEmail("");
      setPass("");
      onClose();
    } catch (error) {
      // error toast is handled inside auth provider
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "oklch(0.05 0.02 258 / 0.85)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md text-frost rounded-md overflow-hidden"
            style={{
              background: "linear-gradient(160deg, oklch(0.18 0.05 258) 0%, oklch(0.10 0.05 258) 100%)",
              border: "1px solid oklch(0.78 0.13 85 / 0.3)",
              boxShadow: "0 40px 100px -20px oklch(0 0 0 / 0.7), 0 0 60px oklch(0.78 0.13 85 / 0.1)",
            }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <button onClick={onClose} className="absolute top-4 right-4 text-frost/60 hover:text-gold transition-colors" aria-label="Close">
              <X className="h-4 w-4" />
            </button>

            <div className="px-8 pt-10 pb-8">
              <div className="text-center mb-7">
                <div className="text-[9px] tracking-[0.5em] text-gold/80 mb-2">HOUSE OF</div>
                <div className="font-display text-2xl tracking-[0.18em] text-gradient-gold">VALERION</div>
                <div className="mt-4 font-display text-xl">{mode === "signin" ? "Welcome Back" : "Create Your Account"}</div>
                <p className="mt-1 text-[10px] tracking-[0.22em] uppercase text-frost/50">
                  {mode === "signin" ? "Sign in to continue" : "Join the House of Valerion"}
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <Field icon={UserIcon} type="text" placeholder="Full Name" value={name} onChange={setName} required />
                )}
                <Field icon={Mail} type="email" placeholder="Email Address" value={email} onChange={setEmail} required />
                <Field icon={Lock} type="password" placeholder="Password" value={pass} onChange={setPass} required />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-gold text-midnight py-3 text-[11px] tracking-[0.24em] uppercase font-medium hover:shadow-[0_0_28px_rgba(212,175,55,0.55)] transition-all mt-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : (mode === "signin" ? "Sign In" : "Create Account")}
                </button>
              </form>

              <div className="mt-6 text-center text-[11px] text-frost/60">
                {mode === "signin" ? "New to Valerion?" : "Already a member?"}{" "}
                <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-gold hover:underline tracking-wider uppercase text-[10px] ml-1">
                  {mode === "signin" ? "Create Account" : "Sign In"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange, required }: { icon: typeof Mail; type: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="relative group">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold/50 group-focus-within:text-gold transition-colors" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-transparent border border-gold/20 pl-10 pr-4 py-3 text-sm text-frost placeholder:text-frost/40 outline-none focus:border-gold transition-colors"
      />
    </div>
  );
}

export default ProfileMenu;
