import React from "react";
import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type Props = { children: ReactNode; title?: string };

export default function AdminLayout({ children }: Props) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F8F9FB] font-inter text-[#101828]">
      <Sidebar />

      <div className="ml-[240px] min-w-0 overflow-hidden">
        <header className="fixed left-[240px] right-0 top-0 z-30 h-[80px] border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
          <Topbar />
        </header>

        <main className="min-h-[calc(100vh-80px)] bg-[#F8F9FB] pb-10 pt-[80px]">
          <div className="w-full max-w-full min-w-0 px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
