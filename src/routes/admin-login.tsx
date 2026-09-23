import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { hasAdminRole, useAuth } from "@/lib/auth";

export default function AdminLogin() {
  const { user, hydrated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hydrated && hasAdminRole(user)) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [hydrated, navigate, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email.trim().toLowerCase(), password);
      const next = new URLSearchParams(location.search).get("next");
      navigate(next?.startsWith("/admin/") ? next : "/admin/dashboard", { replace: true });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F7F9] px-4 py-12 text-[#0F172A]">
      <section className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-8 shadow-[0_28px_90px_-35px_rgba(4,30,66,0.32)] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#FDE68A] to-[#041E42]" />
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF8E8] text-[#A77E14]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#D4AF37]">House of Valerion</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#041E42]">Admin sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[#64748B]">Sign in with an authorized administrator account to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium text-[#334155]">
            Email
            <span className="relative mt-2 block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C8A13B]" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-[14px] border border-[#E5E7EB] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#C8A13B] focus:ring-2 focus:ring-[#C8A13B]/20"
              />
            </span>
          </label>

          <label className="block text-sm font-medium text-[#334155]">
            Password
            <span className="relative mt-2 block">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C8A13B]" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-[14px] border border-[#E5E7EB] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#C8A13B] focus:ring-2 focus:ring-[#C8A13B]/20"
              />
            </span>
          </label>

          {error && <p role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <button
            type="submit"
            disabled={loading || !hydrated}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#041E42] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#0B315F] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Continue to admin"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </section>
    </main>
  );
}
