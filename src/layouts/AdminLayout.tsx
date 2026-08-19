import { ReactNode } from "react";
import Sidebar from "@/components/sidebar/Sidebar";
import Topbar from "@/components/topbar/Topbar";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[#F6F7F9] text-[#0F172A]">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-[280px] lg:flex">
        <Sidebar />
      </div>

      <div className="lg:ml-[280px]">
        <div className="sticky top-0 z-30 h-[72px] border-b border-[#E5E7EB] bg-[#F6F7F9]/95 backdrop-blur-sm">
          <Topbar />
        </div>
        <main className="min-h-[calc(100vh-72px)] overflow-y-auto px-8 py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
