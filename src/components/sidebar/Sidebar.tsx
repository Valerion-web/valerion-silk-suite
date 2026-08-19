import { useMemo } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Boxes,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Sparkles,
  Settings,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const sections = [
  {
    label: "Dashboard",
    items: [
      { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", path: "/admin/products", icon: Package },
      { label: "Categories", path: "/admin/categories", icon: Tag },
      { label: "Brands", path: "/admin/brands", icon: Sparkles },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Orders", path: "/admin/orders", icon: ShoppingCart },
      { label: "Customers", path: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Inventory",
    items: [{ label: "Inventory", path: "/admin/inventory", icon: Boxes }],
  },
  {
    label: "Marketing",
    items: [{ label: "Marketing", path: "/admin/coupons", icon: CircleDollarSign }],
  },
  {
    label: "Analytics",
    items: [{ label: "Analytics", path: "/admin/reports", icon: TrendingUp }],
  },
  {
    label: "Reports",
    items: [{ label: "Reports", path: "/admin/export-reports", icon: FileText }],
  },
  {
    label: "Settings",
    items: [{ label: "Settings", path: "/admin/settings", icon: Settings }],
  },
];

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const activePath = useMemo(() => location.pathname, [location.pathname]);

  return (
    <aside className="flex h-screen min-h-screen flex-col border-r border-[#08182F]/30 bg-[#08182F] text-white shadow-[18px_0_60px_-30px_rgba(4,30,66,0.45)]">
      <div className="flex flex-col gap-3 px-6 py-5">
        <div className="flex items-center gap-3 rounded-[24px] border border-[#D4AF37]/20 bg-[#F9E9BF]/10 px-4 py-4 shadow-[0_12px_40px_-24px_rgba(212,175,55,0.4)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-[#F2E5B7]">House of</p>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Valerion</p>
          </div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#F2E5B7]">Luxury Menswear</p>
          <p className="mt-1 text-sm font-semibold text-white">Admin operating system</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 admin-scrollbar">
        {sections.map((section) => (
          <div key={section.label} className="mb-6 last:mb-0">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-[0.35em] text-[#7B8FAD]">{section.label}</p>
            <div className="space-y-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-semibold tracking-[0.01em] transition duration-200 ${
                      isActive
                        ? "bg-[#D4AF37]/15 text-white shadow-[0_0_0_1px_rgba(212,175,55,0.25)]"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? "bg-[#D4AF37]/20 text-[#D4AF37]" : "bg-white/5 text-[#D4AF37]"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-4 py-5">
        <div className="mb-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#F2E5B7]">Signed in as</p>
          <p className="mt-2 text-sm font-semibold text-white">{user?.name || "Admin"}</p>
          <p className="mt-1 text-xs text-[#A7B0D0]">{user?.email || "admin@houseofvalerion.com"}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#122441] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2039]"
        >
          <LogOut className="h-4 w-4 text-[#D4AF37]" />
          Logout
        </button>
      </div>
    </aside>
  );
}
