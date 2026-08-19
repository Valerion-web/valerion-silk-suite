import { useState } from "react";
import { Link } from "react-router-dom";
import { BellRing, Search, User } from "lucide-react";
import { useBreadcrumbs } from "@/hooks/useBreadcrumbs";

export default function Topbar() {
  const breadcrumbs = useBreadcrumbs();
  const [query, setQuery] = useState("");

  return (
    <div className="flex h-full items-center justify-between px-6">
      <div className="flex min-w-0 items-center gap-4">
        <nav className="flex items-center gap-3 text-sm text-[#64748B]">
          {breadcrumbs.map((item, index) => (
            <div key={item.path} className="flex items-center gap-3">
              <Link to={item.path} className="transition hover:text-[#041E42]">
                {item.label}
              </Link>
              {index < breadcrumbs.length - 1 ? <span className="text-[#CBD5E1]">/</span> : null}
            </div>
          ))}
        </nav>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
          }}
          className="relative max-w-md flex-1"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search House of Valerion"
            className="w-full rounded-full border border-[#E5E7EB] bg-white px-12 py-3 text-sm text-[#0F172A] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </form>

        <button
          type="button"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#0F172A] transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
          aria-label="Notifications"
        >
          <BellRing className="h-5 w-5" />
        </button>

        <button
          type="button"
          className="inline-flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#0F172A] transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
          aria-label="Profile menu"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFC] text-sm text-[#041E42] shadow-sm">
            <User className="h-4 w-4" />
          </span>
          <span>Admin</span>
        </button>
      </div>
    </div>
  );
}
