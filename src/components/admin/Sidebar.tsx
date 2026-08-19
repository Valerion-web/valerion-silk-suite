import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Tag,
  Sparkles,
  Boxes,
  ShoppingCart,
  Users,
  TrendingUp,
  FileText,
  CircleDollarSign,
  MessageSquare,
  Settings,
  LifeBuoy,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const MENU = [
  { label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Categories", to: "/admin/categories", icon: Tag },
  { label: "Brands", to: "/admin/brands", icon: Sparkles },
  { label: "Inventory", to: "/admin/inventory", icon: Boxes },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Customers", to: "/admin/users", icon: Users },
  { label: "Analytics", to: "/admin/analytics", icon: TrendingUp },
  { label: "Reports", to: "/admin/reports", icon: FileText },
  { label: "Marketing", to: "/admin/marketing", icon: CircleDollarSign },
  { label: "Reviews", to: "/admin/reviews", icon: MessageSquare },
  { label: "Users", to: "/admin/users?section=users", icon: User },
  { label: "Settings", to: "/admin/settings", icon: Settings },
  { label: "Support", to: "/admin/support", icon: LifeBuoy },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();

  return (
    <aside aria-label="House of Valerion admin navigation" className="fixed left-0 top-0 bottom-0 z-40 w-[240px] bg-[#081321] text-white shadow-[0_30px_80px_-40px_rgba(8,19,33,0.9)]">
      <div className="flex h-full flex-col">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D4AF37] text-[#081321] text-lg font-semibold">V</div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#94A3B8]">House of</p>
              <p className="text-sm font-semibold text-white">Valerion</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <ul className="space-y-2">
            {MENU.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 w-full rounded-[14px] px-4 py-3 text-sm font-medium transition duration-200 ${
                        isActive
                          ? "border-l-4 border-[#C9A227] bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)] ring-1 ring-[#C9A227]/20"
                          : "text-[#94A3B8] hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-[#C9A227] transition duration-200 group-hover:bg-[#C9A227]/10">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E6E2D0] text-[#081321] text-sm font-semibold shadow-sm">
              {(user?.name || "A")[0]}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user?.name || "Admin"}</p>
              <p className="truncate text-xs text-[#94A3B8]">Administrator</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="mt-4 inline-flex w-full items-center justify-center rounded-[12px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#D4AF37] transition hover:bg-white/10"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
