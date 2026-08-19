import React, { useState, useRef, useEffect } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function ProfileMenu({ compact = false, showName = false }: { compact?: boolean; showName?: boolean }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-3 rounded-full hover:bg-gray-50 px-3 py-1.5"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="h-10 w-10 rounded-full bg-[#E6E2D0] flex items-center justify-center text-[#071120] font-medium">{(user?.name || "A")[0]}</div>
        {showName && (
          <div className="hidden items-start sm:flex flex-col leading-tight">
            <span className="text-sm font-medium">{user?.name || "Admin"}</span>
            <span className="text-xs text-gray-400">Administrator</span>
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-48 rounded-[12px] bg-white shadow-md ring-1 ring-black/5">
          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
            <User className="h-4 w-4 text-gray-600" />
            Account
          </button>
          <button className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
            <Settings className="h-4 w-4 text-gray-600" />
            Settings
          </button>
          <hr className="my-1 border-t border-gray-100" />
          <button onClick={() => signOut()} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-gray-50">
            <LogOut className="h-4 w-4 text-rose-600" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
