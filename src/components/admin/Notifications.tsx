import React from "react";
import { Bell } from "lucide-react";

export default function Notifications({ count = 0 }: { count?: number }) {
  return (
    <div className="relative">
      <button className="relative rounded-full bg-white/5 p-2 text-slate-700 hover:bg-white/10">
        <Bell className="h-5 w-5 text-slate-800" />
      </button>

      {count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#D4AF37] px-1.5 text-xs font-semibold text-[#071120]">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </div>
  );
}
