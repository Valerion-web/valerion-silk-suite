import React, { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { adminApiFetch } from "@/lib/admin-api";
import { resolveAssetUrl } from "@/lib/api";
import { AdminContextProvider, useAdminContext } from "@/lib/admin-context";
import PremiumDashboardPage from "@/components/admin/PremiumDashboard";
import AdminLayout from "@/components/admin/AdminLayout";
import InventoryDashboard from "@/components/admin/inventory/InventoryDashboard";
import InventoryModule from "@/components/admin/inventory/InventoryModule";
import {
  BrandsPage as BrandsModulePage,
  ProductDetailsPage as ProductDetailsModulePage,
  ProductFormPage as ProductFormModulePage,
  ProductsPage as ProductsModulePage,
} from "@/components/admin/products/ProductsModule";
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import { hasAdminRole, useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type DashboardSummary = {
  products?: number;
  orders?: number;
  categories?: number;
  users?: number;
  coupons?: number;
  reviews?: number;
  pendingOrders?: number;
  lowStockProducts?: number;
};

type ProductRecord = {
  id: number;
  name?: string;
  slug?: string;
  description?: string;
  brand?: string;
  price?: number | string;
  countInStock?: number;
  images?: string[];
  category?: { id?: number; name?: string } | null;
};

type OrderRecord = {
  id: number;
  status?: string;
  totalPrice?: number | string;
  createdAt?: string;
  store?: { id?: number; name?: string; slug?: string } | null;
  user?: { id?: number; name?: string; email?: string; role?: string } | null;
  items?: Array<{
    product?: { id?: number; name?: string; slug?: string; images?: string[] } | null;
    variant?: { id?: number; sku?: string; name?: string; size?: string; color?: string; price?: number | string } | null;
    quantity?: number;
    price?: number | string;
    productId?: number;
    variantId?: number;
  }>;
  statusHistory?: Array<{
    id?: number;
    status?: string;
    createdAt?: string;
    note?: string | null;
    changedBy?: { id?: number; name?: string; email?: string } | null;
  }>;
};

type CategoryRecord = {
  id: number;
  name?: string;
  slug?: string;
  description?: string;
  image?: string | null;
  coverImage?: string | null;
  productCount?: number;
  parentId?: number | null;
  parent?: { id: number; name: string; slug?: string } | null;
  color?: string;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED" | string;
  visibility?: "PUBLIC" | "HIDDEN" | string;
  featured?: boolean;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  revenueShare?: number;
  createdAt?: string;
  updatedAt?: string;
};

type UserRecord = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  createdAt?: string;
  status?: string;
  orders?: number;
  totalSpend?: number;
};

type CouponRecord = {
  id: number;
  code: string;
  discountType: string;
  value: number;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  userUsageLimit: number | null;
  minOrderValue: number | null;
  maxOrderValue: number | null;
  maxDiscount: number | null;
  allowFreeShipping: boolean;
  startsAt: string | null;
  endsAt: string | null;
  productIds: number[];
  categoryIds: number[];
  createdAt: string;
};

type CouponFormValues = {
  code: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  maxOrderValue: string;
  usageLimit: string;
  userUsageLimit: string;
  startsAt: string;
  endsAt: string;
  allowFreeShipping: boolean;
  active: boolean;
  productIds: number[];
  categoryIds: number[];
};

type ReviewRecord = {
  id: number;
  product?: string;
  customer?: string;
  rating?: number;
  comment?: string;
  status?: string;
};

type DashboardData = DashboardSummary & {
  charts?: {
    revenueTrend?: Array<{ name: string; revenue: number; orders: number }>;
    salesMix?: Array<{ name: string; value: number }>;
    inventoryLevels?: Array<{ name: string; value: number }>;
    customerMomentum?: Array<{ name: string; value: number }>;
  };
  topProducts?: Array<{ name: string; units: number; revenue: number; growthPercent: number }>;
  lowStockAlerts?: Array<{ id: number; name: string; sku: string; countInStock: number; price: number }>;
};

type SalesReportOrder = {
  id: number;
  customer?: string;
  items?: number;
  revenue?: number;
  paymentMethod?: string;
  status?: string;
  createdAt?: string;
};

type SettingsRecord = {
  storeName?: string;
  supportEmail?: string;
  currency?: string;
  taxRate?: number;
  freeShippingThreshold?: number;
  maintenanceMode?: boolean;
};

const productSubSections = [
  { label: "All Products", path: "/admin/products", icon: Package },
  { label: "Add Product", path: "/admin/products/add", icon: PlusCircle },
  { label: "Categories", path: "/admin/categories", icon: Tag },
  { label: "Brands", path: "/admin/brands", icon: Sparkles },
];

const sidebarGroups = [
  { key: "dashboard", label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  {
    key: "products",
    label: "Products",
    icon: Package,
    items: productSubSections,
  },
  {
    key: "inventory",
    label: "Inventory",
    icon: Boxes,
    items: [
      { label: "Overview", path: "/admin/inventory", icon: Boxes },
      { label: "Low stock", path: "/admin/inventory?view=low-stock", icon: AlertCircle },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    icon: ShoppingCart,
    items: [
      { label: "All orders", path: "/admin/orders", icon: ShoppingCart },
      { label: "Pending", path: "/admin/orders?status=pending", icon: Activity },
      { label: "Delivered", path: "/admin/orders?status=delivered", icon: PackageCheck },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: TrendingUp,
    items: [
      { label: "Coupons", path: "/admin/coupons", icon: CircleDollarSign },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: FileText,
    items: [
      { label: "Sales reports", path: "/admin/sales-reports", icon: BarChart3 },
      { label: "Exports", path: "/admin/export-reports", icon: Download },
    ],
  },
];

type SectionConfig = {
  title: string;
  subtitle: string;
  statLabel: string;
  statValue: string;
};

function getSectionConfig(pathname: string): SectionConfig {
  const normalized = pathname.replace(/^\/admin\/?/, "") || "dashboard";
  const sections: Record<string, SectionConfig> = {
    dashboard: {
      title: "Executive dashboard",
      subtitle: "Review orders, inventory, categories, and live admin activity in one premium command center.",
      statLabel: "Revenue",
      statValue: "Live overview",
    },
    products: {
      title: "Product management",
      subtitle: "Manage every product record with inventory, pricing, and catalog assignments in one polished interface.",
      statLabel: "Live products",
      statValue: "Real-time catalog",
    },
    inventory: {
      title: "Inventory management",
      subtitle: "Track stock across the catalog, adjust inventory levels, and keep low-stock items under control.",
      statLabel: "Inventory control",
      statValue: "Live oversight",
    },
    "products/add": {
      title: "Add product",
      subtitle: "Create a new House of Valerion item with premium product metadata and catalog tagging.",
      statLabel: "New product",
      statValue: "Ready to publish",
    },
    "products/:productId/edit": {
      title: "Edit product",
      subtitle: "Update product details, stock and brand information without leaving the admin shell.",
      statLabel: "Product edit",
      statValue: "Instant control",
    },
    orders: {
      title: "Order management",
      subtitle: "Process recent orders, update fulfillment status, and review customer order details.",
      statLabel: "Open orders",
      statValue: "Live queue",
    },
    categories: {
      title: "Category management",
      subtitle: "Maintain catalog categories for premium merchandising and product discovery.",
      statLabel: "Collections",
      statValue: "Organize elegantly",
    },
    users: {
      title: "User administration",
      subtitle: "Review customer and team accounts, roles, and membership status securely.",
      statLabel: "Total users",
      statValue: "Managed safely",
    },
    coupons: {
      title: "Coupon campaigns",
      subtitle: "Create and manage discount codes for luxury promotions and loyalty campaigns.",
      statLabel: "Active coupons",
      statValue: "Promotional control",
    },
    reviews: {
      title: "Review moderation",
      subtitle: "Approve, reject and manage product reviews before they appear in the storefront.",
      statLabel: "Pending reviews",
      statValue: "Customer sentiment",
    },
    reports: {
      title: "Executive reports",
      subtitle: "Analyze revenue performance across daily, weekly, monthly, and yearly periods.",
      statLabel: "Report cadence",
      statValue: "Revenue insight",
    },
    "export-reports": {
      title: "Export reports",
      subtitle: "Download product, inventory, order and customer reports in CSV, XLSX or PDF format.",
      statLabel: "Report exports",
      statValue: "Data ready",
    },
    "audit-logs": {
      title: "Audit logs",
      subtitle: "Review operational events, stock adjustments, and internal actions from the executive command center.",
      statLabel: "Operational trail",
      statValue: "Tracked securely",
    },
    notifications: {
      title: "Notifications",
      subtitle: "Monitor signals from orders, stock events, and customer activity without leaving the dashboard.",
      statLabel: "Live signals",
      statValue: "Always on",
    },
    settings: {
      title: "Store settings",
      subtitle: "Update storefront configuration, currency, shipping, and support preferences.",
      statLabel: "Store status",
      statValue: "Configured premium",
    },
  };
  return sections[normalized] || sections.dashboard;
}

// Safe helper for creating ECharts gradients when `echarts.graphic` may be unavailable
function safeGradient(...args: any[]) {
  try {
    // @ts-ignore
    if (echarts && echarts.graphic && (echarts.graphic as any).LinearGradient) {
      // @ts-ignore
      return new (echarts.graphic as any).LinearGradient(...args);
    }
  } catch (err) {
    // ignore and fallback
  }
  return undefined;
}

class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, message: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console for developer debugging
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState message={this.state.message || "An unexpected error occurred."} />;
    }
    return this.props.children as React.ReactElement;
  }
}

function formatCurrency(value: number | string | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numeric);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function statusPill(status?: string) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  if (normalized === "DELIVERED") return "bg-emerald-100 text-emerald-700";
  if (normalized === "PROCESSING") return "bg-sky-100 text-sky-700";
  if (normalized === "PENDING") return "bg-amber-100 text-amber-700";
  if (normalized === "CANCELLED" || normalized === "REJECTED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function inventoryStatusPill(status?: string) {
  const normalized = String(status || "OUT_OF_STOCK").toUpperCase();
  if (normalized === "IN_STOCK") return "bg-emerald-100 text-emerald-700";
  if (normalized === "LOW_STOCK") return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function inventoryStatusLabel(status?: string) {
  const normalized = String(status || "OUT_OF_STOCK").toUpperCase();
  if (normalized === "IN_STOCK") return "In Stock";
  if (normalized === "LOW_STOCK") return "Low Stock";
  return "Out of Stock";
}

function fetchAdmin(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return adminApiFetch(`/api/admin${path}`, { ...options, headers }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "Admin request failed");
    }
    return data;
  });
}

function withCurrency(value: number | string | undefined, currency = "INR") {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function PremiumStatCard({ label, value, helper, icon: Icon, accent = "gold" }: { label: string; value: string | number; helper: string; icon: typeof ShieldCheck; accent?: "gold" | "navy" }) {
  const accentClasses = accent === "navy"
    ? "border-[#041E42]/12 bg-[#041E42] text-white"
    : "border-[#D4AF37]/25 bg-[#FFF8E8] text-[#D4AF37]";

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-5 shadow-[0_22px_70px_-36px_rgba(4,30,66,0.34)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_85px_-30px_rgba(4,30,66,0.4)]">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#F8D96B] to-[#041E42]" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#64748B]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[#041E42]">{value}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${accentClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-[#4B5563]">{helper}</p>
    </div>
  );
}

function PanelCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[30px] border border-[#E5E7EB]/80 bg-white p-6 shadow-[0_24px_72px_-34px_rgba(4,30,66,0.34)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#D4AF37]">{title}</p>
          {subtitle ? <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function getStatusTone(status?: string) {
  const normalized = String(status || "ACTIVE").toUpperCase();
  if (normalized === "ARCHIVED") return "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";
  if (normalized === "DRAFT") return "border-[#F7D98E] bg-[#FFF8E8] text-[#A16207]";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getVisibilityTone(visibility?: string) {
  const normalized = String(visibility || "PUBLIC").toUpperCase();
  if (normalized === "HIDDEN") return "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ duration: 0.45 }} className="h-full rounded-full" style={{ backgroundColor: color }} />
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[190px] w-[190px] items-center justify-center">
        <svg viewBox="0 0 140 140" className="h-[190px] w-[190px] -rotate-90">
          <circle cx="70" cy="70" r={radius} stroke="#E5E7EB" strokeWidth="18" fill="none" />
          {data.map((entry) => {
            const length = (entry.value / total) * circumference;
            const dash = `${length} ${circumference}`;
            const result = (
              <motion.circle
                key={entry.label}
                cx="70"
                cy="70"
                r={radius}
                stroke={entry.color}
                strokeWidth="18"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={dash}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 0.7 }}
              />
            );
            offset += length;
            return result;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[30px] font-semibold tracking-[-0.02em] text-[#041E42]">{total}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#64748B]">Categories</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {data.map((entry) => (
          <div key={entry.label} className="flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-xs text-[#64748B]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryPreviewCard({ category }: { category: CategoryRecord }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
      <div className="h-24" style={{ background: `linear-gradient(135deg, ${category.color || "#041E42"} 0%, #F8D96B 100%)` }} />
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm font-semibold text-[#041E42]">
            {category.name?.charAt(0).toUpperCase() || "C"}
          </div>
          <div>
            <p className="text-sm font-semibold text-[#041E42]">{category.name || "Category preview"}</p>
            <p className="text-xs text-[#64748B]">Luxury collection</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#4B5563]">{category.description || "Curated for the House of Valerion experience."}</p>
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-2/5 animate-pulse rounded-full bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[20px] bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-[24px] bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-10 text-center text-slate-600">
      <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#D4AF37]">No results</p>
      <h2 className="mt-4 text-xl font-semibold text-[#041E42]">{title}</h2>
      <p className="mt-2 text-sm leading-7">{description}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
      <p className="font-semibold">Unable to load data</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

function AdminRoutePage() {
  const { user, hydrated, isLoggingOut, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const section = getSectionConfig(location.pathname);
  const isDashboard = location.pathname === "/admin/dashboard";
  const isProductSection = useMemo(
    () => location.pathname.startsWith("/admin/products"),
    [location.pathname]
  );

  const productsSectionActive = useMemo(
    () => productSubSections.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    [location.pathname]
  );
  const inventorySectionActive = useMemo(
    () => location.pathname.startsWith("/admin/inventory"),
    [location.pathname]
  );
  const ordersSectionActive = useMemo(
    () => location.pathname.startsWith("/admin/orders"),
    [location.pathname]
  );
  const marketingSectionActive = useMemo(
    () => location.pathname.startsWith("/admin/marketing") || location.pathname.startsWith("/admin/coupons"),
    [location.pathname]
  );
  const reportsSectionActive = useMemo(
    () => location.pathname.startsWith("/admin/reports") || location.pathname.startsWith("/admin/sales-reports") || location.pathname.startsWith("/admin/export-reports"),
    [location.pathname]
  );

  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => ({
    products: productsSectionActive,
    inventory: inventorySectionActive,
    orders: ordersSectionActive,
    marketing: marketingSectionActive,
    reports: reportsSectionActive,
  }));

  useEffect(() => {
    setExpandedGroups((current) => ({
      ...current,
      products: productsSectionActive,
      inventory: inventorySectionActive,
      orders: ordersSectionActive,
      marketing: marketingSectionActive,
      reports: reportsSectionActive,
    }));
  }, [productsSectionActive, inventorySectionActive, ordersSectionActive, marketingSectionActive, reportsSectionActive]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
    navigate("/", { replace: true });
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] px-4 text-center">
        <div className="text-sm text-[#4B5563]">Restoring session…</div>
      </div>
    );
  }

  if (!hasAdminRole(user) && !isLoggingOut) {
    return <Navigate to="/" replace />;
  }

  const breadcrumbItems = location.pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((segment, index, allSegments) => ({
      label: segment.replace(/-/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()),
      path: `/admin/${allSegments.slice(0, index + 1).join("/")}`,
    }));

  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const headerStats = [
    { label: "Revenue today", value: "₹84.2K", tone: "text-[#041E42]" },
    { label: "Pending orders", value: "24", tone: "text-[#D4AF37]" },
    { label: "Inventory status", value: "Balanced", tone: "text-[#0F766E]" },
    { label: "New customers", value: "18", tone: "text-[#2563EB]" },
  ];

  return (
    <AdminContextProvider>
      <AdminLayout>
        <div className={isProductSection ? "space-y-6 py-4" : "px-4 py-5 sm:px-6 lg:px-8 lg:py-6"}>
          {!isDashboard && !isProductSection && (
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[32px] border border-[#E5E7EB]/80 bg-[linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.97))] p-6 shadow-[0_28px_90px_-35px_rgba(4,30,66,0.32)] backdrop-blur-xl sm:p-8"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D4AF37] via-[#FDE68A] to-[#041E42]" />
            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
              <div className="max-w-3xl">
                <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#D4AF37]">
                  <ShieldCheck className="h-4 w-4" />House of Valerion
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
                  <Link to="/admin/dashboard" className="transition hover:text-[#041E42]">Admin</Link>
                  {breadcrumbItems.map((item, index) => (
                    <div key={item.path} className="flex items-center gap-2">
                      <ChevronRight className="h-4 w-4" />
                      <Link to={item.path} className={`transition ${index === breadcrumbItems.length - 1 ? "font-semibold text-[#111111]" : "hover:text-[#041E42]"}`}>
                        {item.label}
                      </Link>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">Welcome back</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#041E42] sm:text-[2.1rem]">{section.title}</h1>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#FFF8E8] px-3 py-1.5 text-sm font-semibold text-[#A77E14]">
                    <CalendarDays className="h-4 w-4" />
                    {todayLabel}
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#4B5563]">{section.subtitle}</p>
              </div>

              {isDashboard ? (
                <div className="rounded-[28px] border border-[#E5E7EB]/80 bg-white/80 p-4 shadow-[0_20px_60px_-34px_rgba(4,30,66,0.28)] backdrop-blur-xl">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#D4AF37]">Live system status</p>
                      <p className="mt-1 text-lg font-semibold text-[#041E42]">Everything is online</p>
                    </div>
                    <div className="rounded-full border border-[#10B981]/20 bg-[#ECFDF5] px-3 py-1.5 text-sm font-semibold text-[#10B981]">Operational</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {headerStats.map((item) => (
                      <div key={item.label} className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#64748B]">{item.label}</p>
                        <p className={`mt-2 text-xl font-semibold ${item.tone}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[28px] border border-[#E5E7EB]/80 bg-white/90 p-6 shadow-[0_20px_60px_-34px_rgba(4,30,66,0.24)] backdrop-blur-xl">
                  <div className="text-sm font-semibold text-[#041E42]">{section.statLabel}</div>
                  <p className="mt-2 text-base text-[#4B5563]">{section.statValue}</p>
                </div>
              )}
            </div>

            {isDashboard && (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#E5E7EB] pt-4">
              <div className="flex min-w-[220px] items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2.5 shadow-sm">
                <Search className="h-4 w-4 text-[#D4AF37]" />
                <input readOnly value="" placeholder="Search insights" className="w-full bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#94A3B8]" />
              </div>
              <button type="button" className="flex items-center justify-center rounded-full border border-[#E5E7EB] bg-white p-2.5 text-[#041E42] shadow-sm transition hover:border-[#D4AF37] hover:text-[#D4AF37]">
                <BellRing className="h-4 w-4" />
              </button>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37] bg-[#FFF8E8] px-4 py-2.5 text-sm font-semibold text-[#041E42] transition hover:bg-[#FDE68A]">
                <Download className="h-4 w-4" />Export
              </button>
              <div className="flex items-center gap-3 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#041E42] text-sm font-semibold text-white">{user?.name?.charAt(0) || "A"}</div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[#041E42]">{user?.name || "Admin"}</p>
                  <p className="text-xs text-[#64748B]">{user?.role || "Administrator"}</p>
                </div>
              </div>
              <Link to="/admin/products/add" className="rounded-full border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Add product</Link>
              <Link to="/admin/orders" className="rounded-full border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Review orders</Link>
              <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37] bg-white px-3.5 py-2 text-sm font-semibold text-[#041E42] transition hover:bg-[#FFF8E8]">
                <ArrowLeft className="h-4 w-4" />Return to storefront
              </Link>
            </div>
            )}
          </motion.header>
          )}

          <div className={`${isProductSection ? "" : "mt-6"} space-y-6`}>
            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="products" element={<ProductsModulePage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="products/add" element={<ProductFormModulePage />} />
              <Route path="products/:productId" element={<ProductDetailsModulePage />} />
              <Route path="products/:productId/edit" element={<ProductFormModulePage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:orderId" element={<OrderDetailsPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="brands" element={<BrandsModulePage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="marketing" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="coupons" element={<CouponsPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="notifications" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="audit-logs" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="reports" element={<SalesReportsPage />} />
              <Route path="sales-reports" element={<SalesReportsPage />} />
              <Route path="support" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="export-reports" element={<ExportReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<div className="rounded-[24px] border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-[0_16px_50px_-28px_rgba(4,30,66,0.28)]">Page not found in admin section.</div>} />
            </Routes>
          </div>
        </div>
        </AdminLayout>
      </AdminContextProvider>
    );
}

function smoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = (current.x + next.x) / 2;
    d += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
  }
  return d;
}

function buildAreaPath(values: number[], width: number, height: number, maxValue: number) {
  if (values.length === 0) return "";
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const step = innerWidth / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: padding + step * index,
    y: padding + innerHeight - (value / Math.max(maxValue, 1)) * innerHeight,
  }));
  const linePath = smoothLinePath(points);
  const baseline = height - padding;
  return `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

function buildLinePath(values: number[], width: number, height: number, maxValue: number) {
  if (values.length === 0) return "";
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const step = innerWidth / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => ({
    x: padding + step * index,
    y: padding + innerHeight - (value / Math.max(maxValue, 1)) * innerHeight,
  }));
  return smoothLinePath(points);
}

function buildPieSegments(values: Array<{ value: number; color: string }>, radius: number, center: number) {
  let cumulative = 0;
  const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
  return values.map((item) => {
    const startAngle = cumulative / total * 360 - 90;
    cumulative += item.value;
    const endAngle = cumulative / total * 360 - 90;
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const start = {
      x: center + radius * Math.cos((startAngle * Math.PI) / 180),
      y: center + radius * Math.sin((startAngle * Math.PI) / 180),
    };
    const end = {
      x: center + radius * Math.cos((endAngle * Math.PI) / 180),
      y: center + radius * Math.sin((endAngle * Math.PI) / 180),
    };
    return {
      ...item,
      d: `M ${center} ${center} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`,
    };
  });
}

function LuxuryPanel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      whileHover={{ y: -6, scale: 1.01, boxShadow: "0 30px 75px -35px rgba(4,30,66,0.4)" }}
      className={`flex h-full flex-col overflow-hidden rounded-[30px] border border-[#E5E7EB]/80 bg-[linear-gradient(145deg,_rgba(255,255,255,0.97),_rgba(248,250,252,0.96))] p-6 shadow-[0_28px_90px_-35px_rgba(4,30,66,0.34)] backdrop-blur-xl ${className || ""}`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.33em] text-[#D4AF37]">{title}</p>
          {subtitle ? <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}


function SalesReportsPage() {
  const [reports, setReports] = useState<Array<{ id: number; customer?: string; revenue?: number; status?: string; createdAt?: string }>>([]);
  const [summary, setSummary] = useState<{ totalRevenue?: number; totalOrders?: number; averageOrderValue?: number }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAdmin("/sales-reports");
        setSummary(data?.summary || {});
        setReports(data?.orders || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load sales reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-3">
        {[
          { title: "Total Revenue", value: summary.totalRevenue ?? 0 },
          { title: "Total Orders", value: summary.totalOrders ?? 0 },
          { title: "Average AOV", value: summary.averageOrderValue ?? 0 },
        ].map((card) => (
          <div key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">{card.title}</p>
            <p className="mt-4 text-3xl font-semibold text-[#041E42]">{withCurrency(card.value)}</p>
          </div>
        ))}
      </section>
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <h2 className="text-lg font-semibold text-[#041E42]">Recent orders</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Revenue</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((order) => (
                <tr key={order.id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA]">
                  <td className="py-3 pr-4 font-medium text-[#111111]">#{order.id}</td>
                  <td className="py-3 pr-4 text-[#4B5563]">{order.customer || "Guest"}</td>
                  <td className="py-3 pr-4 text-[#041E42]">{withCurrency(order.revenue || 0)}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(order.status)}`}>
                      {order.status || "N/A"}
                    </span>
                  </td>
                  <td className="py-3 text-[#4B5563]">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ExportReportsPage() {
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [resource, setResource] = useState<"products" | "orders" | "inventory" | "customers" | "sales-report">("products");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await adminApiFetch(`/api/admin/export/${resource}?format=${exportFormat}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      toast.success("Export generated", { className: "luxury-toast" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Export reports</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Export store data</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4B5563]">
              Download catalog, order, inventory, customer, and sales reports in the format best suited to your workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-[#4B5563]">
              <span className="mb-2 block font-semibold text-[#041E42]">Format</span>
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "csv" | "xlsx" | "pdf")}
                className="w-36 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <label className="text-sm text-[#4B5563]">
              <span className="mb-2 block font-semibold text-[#041E42]">Resource</span>
              <select
                value={resource}
                onChange={(event) => setResource(event.target.value as "products" | "orders" | "inventory" | "customers" | "sales-report")}
                className="w-44 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="products">Products</option>
                <option value="orders">Orders</option>
                <option value="inventory">Inventory</option>
                <option value="customers">Customers</option>
                <option value="sales-report">Sales report</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-[#041E42] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#072e63] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Preparing export..." : `Export ${resource}`}
          </button>
          {downloadUrl ? (
            <a href={downloadUrl} download className="text-sm font-medium text-[#D4AF37] hover:text-[#b88c12]">
              Download latest export
            </a>
          ) : null}
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      </section>
    </div>
  );
}

function DashboardPage() {
  return <PremiumDashboardPage />;
}

function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<"name" | "price" | "stock">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productData, categoryData] = await Promise.all([fetchAdmin("/products"), fetchAdmin("/categories")]);
        setProducts(productData || []);
        setCategories(categoryData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load products");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const matchesSearch =
          normalized.length === 0 ||
          product.name?.toLowerCase().includes(normalized) ||
          product.brand?.toLowerCase().includes(normalized) ||
          product.category?.name?.toLowerCase().includes(normalized);
        const matchesCategory = categoryFilter === "" || product.category?.id === Number(categoryFilter);
        const stock = Number(product.countInStock ?? 0);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "inStock" && stock > 5) ||
          (statusFilter === "lowStock" && stock > 0 && stock <= 5) ||
          (statusFilter === "outOfStock" && stock <= 0);
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortField === "price") {
          return sortDirection === "asc"
            ? Number(a.price || 0) - Number(b.price || 0)
            : Number(b.price || 0) - Number(a.price || 0);
        }
        if (sortField === "stock") {
          return sortDirection === "asc"
            ? Number(a.countInStock || 0) - Number(b.countInStock || 0)
            : Number(b.countInStock || 0) - Number(a.countInStock || 0);
        }
        return sortDirection === "asc"
          ? String(a.name || "").localeCompare(String(b.name || ""))
          : String(b.name || "").localeCompare(String(a.name || ""));
      });
  }, [products, query, categoryFilter, statusFilter, sortField, sortDirection]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter, sortField, sortDirection]);

  const handleDeleteProduct = async (productId: number) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      await fetchAdmin(`/products/${productId}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== productId));
      toast.success("Product deleted successfully", { className: "luxury-toast" });
      if (selectedProduct?.id === productId) setSelectedProduct(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to delete product");
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Product catalog</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">All products</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/products/add")}
            className="inline-flex items-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-medium text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
          >
            <PlusCircle className="h-4 w-4" />
            Add product
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="sr-only">Search products</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, brand, or category"
              className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="sr-only">Category filter</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Stock filter</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="all">All stock statuses</option>
                <option value="inStock">In stock</option>
                <option value="lowStock">Low stock</option>
                <option value="outOfStock">Out of stock</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="block">
            <span className="text-sm text-slate-500">Sort by</span>
            <select
              value={sortField}
              onChange={(event) => setSortField(event.target.value as "name" | "price" | "stock")}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="stock">Stock</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-slate-500">Direction</span>
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
        </div>
      </section>

      {actionError ? <ErrorState message={actionError} /> : null}

      {filteredProducts.length === 0 ? (
        <EmptyState title="No products found" description="Try adjusting your search, filters, or adding a new catalog item." />
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Stock</th>
                  <th className="py-3 pr-4">Price</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => (
                  <tr key={product.id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-2xl bg-slate-100">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-xs font-semibold uppercase text-[#64748b]">
                              {String(product.name || "?").charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-[#111111]">{product.name}</div>
                          <div className="text-xs text-[#6B7280]">{product.brand || "House of Valerion"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[#4B5563]">{product.category?.name || "Uncategorized"}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{product.countInStock ?? 0} units</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{formatCurrency(product.price)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(product)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[#4B5563]">
              <div>{`Showing ${paginatedProducts.length} of ${filteredProducts.length} products`}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#041E42] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#041E42] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {selectedProduct ? (
            <div className="mt-6 space-y-4 rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-6 text-[#111111]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Product details</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#041E42]">{selectedProduct.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:bg-[#FFF8E8]"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Category</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{selectedProduct.category?.name || "Uncategorized"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Stock</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{selectedProduct.countInStock ?? 0} units</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Price</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{formatCurrency(selectedProduct.price)}</p>
                </div>
              </div>
              <p className="text-sm leading-7 text-[#4B5563]">{selectedProduct.description || "No additional product description available."}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function ProductFormPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const isEditing = Boolean(productId);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    countInStock: "",
    brand: "",
    categoryId: "",
    images: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [categoryData, products] = await Promise.all([fetchAdmin("/categories"), fetchAdmin("/products")]);
        setCategories(categoryData || []);
        if (isEditing && productId) {
          const current = (products || []).find((item: ProductRecord) => String(item.id) === productId);
          if (!current) {
            setError("Product not found for editing.");
            return;
          }
          setForm({
            name: current.name || "",
            description: current.description || "",
            price: String(current.price ?? ""),
            countInStock: String(current.countInStock ?? ""),
            brand: current.brand || "",
            categoryId: current.category?.id ? String(current.category.id) : "",
            images: Array.isArray(current.images) ? current.images.join(", ") : "",
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load product editor");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isEditing, productId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        countInStock: Number(form.countInStock || 0),
        brand: form.brand,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        images: form.images.split(",").map((item) => item.trim()).filter(Boolean),
      };
      const endpoint = isEditing && productId ? `/products/${productId}` : "/products";
      const method = isEditing ? "PUT" : "POST";
      await fetchAdmin(endpoint, { method, body: JSON.stringify(payload) });
      toast.success(isEditing ? "Product updated" : "Product created", { className: "luxury-toast" });
      navigate("/admin/products", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Product editor</p>
          <h2 className="mt-2 text-xl font-semibold text-[#041E42]">{isEditing ? "Edit product" : "Add product"}</h2>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/products")}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
        >
          Back to products
        </button>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Name</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Brand</span>
          <input
            value={form.brand}
            onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="md:col-span-2 text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            required
            rows={5}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Price</span>
          <input
            type="number"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            required
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Stock</span>
          <input
            type="number"
            value={form.countInStock}
            onChange={(event) => setForm((current) => ({ ...current, countInStock: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Category</span>
          <select
            value={form.categoryId}
            onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2 text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Image URLs</span>
          <input
            value={form.images}
            onChange={(event) => setForm((current) => ({ ...current, images: event.target.value }))}
            placeholder="Enter comma-separated URLs"
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#4B5563]">Use real image URLs to ensure the product appears correctly in the storefront.</p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-[#041E42] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#072e63] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : isEditing ? "Update product" : "Create product"}
          </button>
        </div>
      </form>
    </section>
  );
}

const VALID_ORDER_STATUSES = ['PLACED', 'PENDING', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function OrdersPage() {
  const navigate = useNavigate();
  const { isParentContext } = useAdminContext();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (query.trim()) params.set('search', query.trim());
        const suffix = params.toString();
        const data = await fetchAdmin(`/orders${suffix ? `?${suffix}` : ''}`);
        setOrders(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load orders");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [query, statusFilter]);

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const customerName = order.user?.name?.toLowerCase() ?? "";
      const customerEmail = order.user?.email?.toLowerCase() ?? "";
      const matchesSearch =
        normalized.length === 0 ||
        String(order.id).includes(normalized) ||
        customerName.includes(normalized) ||
        customerEmail.includes(normalized);
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, query, statusFilter]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const handleUpdateStatus = async (orderId: number, status: string) => {
    if (isParentContext) return;
    try {
      const updated = await fetchAdmin(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrders((current) => current.map((item) => (item.id === orderId ? { ...item, status: updated.status } : item)));
      toast.success("Order status updated", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update status", { className: "luxury-toast" });
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (isParentContext) return;
    if (!window.confirm("Delete this order permanently?")) return;
    try {
      await fetchAdmin(`/orders/${orderId}`, { method: "DELETE" });
      setOrders((current) => current.filter((item) => item.id !== orderId));
      setSelectedOrder((current) => (current?.id === orderId ? null : current));
      toast.success("Order deleted", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete order", { className: "luxury-toast" });
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Order pipeline</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Orders</h2>
            {isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#A16207]">Parent context • Read only</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="sr-only">Search orders</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by order, customer or email"
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>
            <label className="block">
              <span className="sr-only">Order status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="all">All statuses</option>
                {VALID_ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>{status.replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {paginatedOrders.length === 0 ? (
        <EmptyState title="No orders found" description="Use filters or check again later for newly placed orders." />
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr key={order.id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-4 font-medium text-[#111111]">#{order.id}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{order.user?.name || order.user?.email || "Guest"}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{formatDate(order.createdAt)}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{formatCurrency(order.totalPrice)}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(order.status)}`}>{order.status || "Unknown"}</span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/orders/${order.id}`)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          View
                        </button>
                        {!isParentContext && <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "PROCESSING")}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          Process
                        </button>}
                        {!isParentContext && <button
                          type="button"
                          onClick={() => handleUpdateStatus(order.id, "DELIVERED")}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          Deliver
                        </button>}
                        {!isParentContext && <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[#4B5563]">
              <div>{`Showing ${paginatedOrders.length} of ${filteredOrders.length} orders`}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#041E42] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-2">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#041E42] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {selectedOrder ? (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-6 text-[#111111]">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Order details</p>
                  <h3 className="mt-2 text-lg font-semibold text-[#041E42]">Order #{selectedOrder.id}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#041E42] hover:bg-[#FFF8E8]"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Customer</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{selectedOrder.user?.name || "Guest"}</p>
                  <p className="text-sm text-[#4B5563]">{selectedOrder.user?.email}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Ordered on</p>
                  <p className="mt-1 text-sm text-[#4B5563]">{formatDate(selectedOrder.createdAt)}</p>
                  <p className="text-sm text-[#4B5563]">{formatCurrency(selectedOrder.totalPrice)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#041E42]">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(selectedOrder.status)}`}>{selectedOrder.status || "Unknown"}</span>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-sm font-semibold text-[#041E42]">Items</p>
                <div className="mt-3 space-y-3">
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-[#041E42]">{item.product?.name || "Unknown product"}</p>
                          <p className="text-sm text-[#4B5563]">Qty: {item.quantity ?? 1}</p>
                        </div>
                        <p className="text-sm font-semibold text-[#041E42]">{formatCurrency(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

function CategoriesPage() {
  const { isParentContext } = useAdminContext();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedCategory, setSelectedCategory] = useState<CategoryRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState({ image: false, coverImage: false });
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "archive" | "duplicate"; category: CategoryRecord | null }>({ type: "delete", category: null });
  const [activity, setActivity] = useState<Array<{ id: number; title: string; detail: string; time: string }>>([]);
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
    coverImage: "",
    parentId: "" as number | "",
    color: "#D4AF37",
    status: "ACTIVE",
    visibility: "PUBLIC",
    featured: false,
    sortOrder: 1,
    seoTitle: "",
    seoDescription: "",
    keywords: "",
    iconPreview: "",
    coverPreview: "",
  });

  const defaultDraft = useMemo(
    () => ({
      name: "",
      slug: "",
      description: "",
      image: "",
      coverImage: "",
      parentId: "" as number | "",
      color: "#D4AF37",
      status: "ACTIVE",
      visibility: "PUBLIC",
      featured: false,
      sortOrder: 1,
      seoTitle: "",
      seoDescription: "",
      keywords: "",
      iconPreview: "",
      coverPreview: "",
    }),
    []
  );

  useEffect(() => {
    if (isParentContext) {
      setComposerOpen(false);
      setConfirmAction({ type: "delete", category: null });
    }
  }, [isParentContext]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAdmin("/categories");
        const rawItems = Array.isArray(data) ? data : Array.isArray((data as { categories?: CategoryRecord[] }).categories) ? (data as { categories?: CategoryRecord[] }).categories! : [];
        const mapped = rawItems
          .filter((item) => Number.isInteger(Number(item?.id)))
          .map((item, index) => ({
              id: Number(item.id),
              name: item.name || `Collection ${index + 1}`,
              slug: item.slug || slugify(item.name || `collection-${index + 1}`),
              description: item.description || "Curated for the House of Valerion experience.",
              image: item.image ?? null,
              coverImage: item.coverImage ?? null,
              productCount: item.productCount ?? (index + 1) * 6,
              parentId: item.parentId ?? null,
              parent: item.parent || null,
              revenueShare: item.revenueShare ?? Math.max(8, 34 - index),
              status: item.status || "ACTIVE",
              visibility: item.visibility || "PUBLIC",
              featured: item.featured ?? index === 0,
              color: item.color || ["#D4AF37", "#0A1931", "#1E3A8A", "#7C3AED"][index % 4],
              sortOrder: item.sortOrder ?? index + 1,
              createdAt: item.createdAt || new Date(Date.now() - index * 86400000).toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString(),
              seoTitle: item.seoTitle || `${item.name || `Collection ${index + 1}`} — House of Valerion`,
              seoDescription: item.seoDescription || item.description || "Luxury fashion category crafted for premium discovery.",
              keywords: item.keywords || ["luxury", "fashion"],
            }));
        setCategories(mapped);
        setActivity([
          { id: 1, title: "Catalogue synced", detail: `${mapped.length} categories ready for review.`, time: "Just now" },
          { id: 2, title: "Collections refined", detail: "Premium status and visibility signals updated.", time: "10 min ago" },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load categories");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [defaultDraft]);

  const filteredCategories = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...categories]
      .filter((category) => {
        const parentName = category.parent?.name || categories.find((item) => item.id === category.parentId)?.name;
        const matchesSearch = !normalized || [category.name, category.description, category.slug, parentName].some((value) => (value || "").toLowerCase().includes(normalized));
        const matchesStatus = statusFilter === "all" || category.status?.toUpperCase() === statusFilter.toUpperCase();
        const matchesVisibility = visibilityFilter === "all" || category.visibility?.toUpperCase() === visibilityFilter.toUpperCase();
        const matchesProductCount = productFilter === "all" || (productFilter === "high" && (category.productCount ?? 0) >= 24) || (productFilter === "low" && (category.productCount ?? 0) < 24);
        return matchesSearch && matchesStatus && matchesVisibility && matchesProductCount;
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "name":
            return (left.name || "").localeCompare(right.name || "");
          case "products":
            return (right.productCount ?? 0) - (left.productCount ?? 0);
          case "revenue":
            return (right.revenueShare ?? 0) - (left.revenueShare ?? 0);
          default:
            return (new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime());
        }
      });
    const roots = filtered.filter((category) => category.parentId == null);
    const children = filtered.filter((category) => category.parentId != null);
    const ordered: CategoryRecord[] = [];
    for (const root of roots) {
      ordered.push(root, ...children.filter((child) => child.parentId === root.id));
    }
    const includedIds = new Set(ordered.map((category) => category.id));
    return [...ordered, ...children.filter((category) => !includedIds.has(category.id))];
  }, [categories, search, sortBy, statusFilter, visibilityFilter, productFilter]);

  const rootCategories = categories.filter((category) => category.parentId == null);
  const selectedCategoryHasChildren = selectedCategory
    ? categories.some((category) => category.parentId === selectedCategory.id)
    : false;

  const totalProducts = categories.reduce((sum, category) => sum + (category.productCount ?? 0), 0);
  const activeCategories = categories.filter((category) => category.status?.toUpperCase() !== "ARCHIVED").length;
  const largestCategory = [...categories].sort((left, right) => (right.productCount ?? 0) - (left.productCount ?? 0))[0];
  const recentlyUpdated = [...categories].sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())[0];
  const heroMetrics = [
    { label: "Total categories", value: categories.length, helper: "Curated collections", icon: Tag },
    { label: "Active categories", value: activeCategories, helper: "Live and visible", icon: CheckCircle2 },
    { label: "Total products", value: totalProducts, helper: "Assigned across catalogue", icon: Package },
    { label: "Largest category", value: largestCategory?.name || "—", helper: largestCategory ? `${largestCategory.productCount ?? 0} products` : "No data", icon: Sparkles },
    { label: "Recently updated", value: recentlyUpdated ? formatDate(recentlyUpdated.updatedAt) : "—", helper: recentlyUpdated ? recentlyUpdated.name : "No updates", icon: RefreshCw },
    { label: "Avg / category", value: categories.length ? Math.round(totalProducts / categories.length) : 0, helper: "Products per category", icon: BarChart3 },
  ];

  const distributionData = useMemo(() => {
    const active = categories.filter((category) => category.status?.toUpperCase() !== "ARCHIVED").length;
    const draft = categories.filter((category) => category.status?.toUpperCase() === "DRAFT").length;
    const archived = categories.filter((category) => category.status?.toUpperCase() === "ARCHIVED").length;
    return [
      { label: "Active", value: active, color: "#D4AF37" },
      { label: "Draft", value: draft, color: "#0A1931" },
      { label: "Archived", value: archived, color: "#CBD5E1" },
    ];
  }, [categories]);

  const shareData = useMemo(() => categories.slice(0, 5).map((category) => ({ name: category.name || "Collection", value: category.revenueShare ?? 0, color: category.color || "#D4AF37" })), [categories]);

  const resetFilters = () => {
    setSearch("");
    setSortBy("latest");
    setStatusFilter("all");
    setVisibilityFilter("all");
    setProductFilter("all");
  };

  const uploadCategoryImage = async (file: File, field: "image" | "coverImage") => {
    const previewField = field === "image" ? "iconPreview" : "coverPreview";
    const previousPreview = draft[previewField];
    if (previousPreview.startsWith("blob:")) URL.revokeObjectURL(previousPreview);
    const previewUrl = URL.createObjectURL(file);
    setDraft((current) => ({ ...current, [previewField]: previewUrl }));
    setUploadingMedia((current) => ({ ...current, [field]: true }));

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetchAdmin("/categories/images", { method: "POST", body: formData });
      if (typeof response?.url !== "string" || !response.url.startsWith("/uploads/categories/")) {
        throw new Error("Image upload did not return a valid path.");
      }
      URL.revokeObjectURL(previewUrl);
      setDraft((current) => ({ ...current, [field]: response.url, [previewField]: response.url }));
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setDraft((current) => ({ ...current, [previewField]: current[field] || "" }));
      toast.error(err instanceof Error ? err.message : "Unable to upload category image", { className: "luxury-toast" });
    } finally {
      setUploadingMedia((current) => ({ ...current, [field]: false }));
    }
  };

  const openCreateComposer = () => {
    setMode("create");
    setSelectedCategory(null);
    setDraft(defaultDraft);
    setComposerOpen(true);
  };

  const openEditComposer = (category: CategoryRecord) => {
    setMode("edit");
    setSelectedCategory(category);
    setDraft({
      name: category.name || "",
      slug: category.slug || slugify(category.name || ""),
      description: category.description || "",
      image: category.image || "",
      coverImage: category.coverImage || "",
      parentId: category.parentId ?? "",
      color: category.color || "#D4AF37",
      status: category.status || "ACTIVE",
      visibility: category.visibility || "PUBLIC",
      featured: Boolean(category.featured),
      sortOrder: category.sortOrder ?? 1,
      seoTitle: category.seoTitle || "",
      seoDescription: category.seoDescription || "",
      keywords: (category.keywords || []).join(", "),
      iconPreview: category.image || "",
      coverPreview: category.coverImage || "",
    });
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setSelectedCategory(null);
    setDraft(defaultDraft);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Category name is required.", { className: "luxury-toast" });
      return;
    }
    const nextSlug = slugify(draft.slug || draft.name);
    const duplicate = categories.some((category) => category.slug === nextSlug && (!selectedCategory || category.id !== selectedCategory.id));
    if (duplicate) {
      toast.error("A category with this slug already exists.", { className: "luxury-toast" });
      return;
    }

    const payload = {
      name: draft.name.trim(),
      slug: nextSlug,
      description: draft.description.trim(),
      image: draft.image || null,
      coverImage: draft.coverImage || null,
      parentId: draft.parentId === "" ? null : Number(draft.parentId),
      color: draft.color,
      status: draft.status as CategoryRecord["status"],
      visibility: draft.visibility as CategoryRecord["visibility"],
      featured: draft.featured,
      sortOrder: Number(draft.sortOrder || 1),
      productCount: selectedCategory?.productCount ?? Math.max(6, Math.round(Math.random() * 20 + 6)),
      revenueShare: selectedCategory?.revenueShare ?? 12,
      seoTitle: draft.seoTitle.trim() || `${draft.name.trim()} — House of Valerion`,
      seoDescription: draft.seoDescription.trim() || `Luxury category for ${draft.name.trim()} crafted for premium discovery.`,
      keywords: draft.keywords.split(",").map((item) => item.trim()).filter(Boolean),
      createdAt: selectedCategory?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      if (mode === "edit" && selectedCategory) {
        const response = await fetchAdmin(`/categories/${selectedCategory.id}`, { method: "PUT", body: JSON.stringify(payload) });
        if (Number(response?.id) !== selectedCategory.id) throw new Error("Category update did not return the saved category.");
        const updatedCategory: CategoryRecord = {
          ...selectedCategory,
          ...payload,
          ...response,
          id: selectedCategory.id,
          parentId: response.parentId ?? payload.parentId,
        };
        setCategories((current) => current.map((item) => (item.id === selectedCategory.id ? updatedCategory : item)));
        setActivity((current) => [{ id: Date.now(), title: "Category updated", detail: `${payload.name} refreshed in the catalog.`, time: "Just now" }, ...current].slice(0, 4));
        toast.success("Category updated", { className: "luxury-toast" });
      } else {
        const response = await fetchAdmin("/categories", { method: "POST", body: JSON.stringify(payload) });
        const createdId = Number(response?.id);
        if (!Number.isInteger(createdId) || createdId < 1) throw new Error("Category creation did not return a valid category ID.");
        const createdCategory: CategoryRecord = {
          ...payload,
          ...response,
          id: createdId,
          parentId: response.parentId ?? payload.parentId,
        };
        setCategories((current) => [createdCategory, ...current]);
        setActivity((current) => [{ id: Date.now(), title: "Category created", detail: `${payload.name} is now available.`, time: "Just now" }, ...current].slice(0, 4));
        toast.success("Category created", { className: "luxury-toast" });
      }
      closeComposer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save category", { className: "luxury-toast" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId: number) => {
    const target = categories.find((category) => category.id === categoryId);
    if (!target) return;
    try {
      await fetchAdmin(`/categories/${categoryId}`, { method: "DELETE" });
      setCategories((current) => current.filter((category) => category.id !== categoryId));
      setActivity((current) => [{ id: Date.now(), title: "Category archived", detail: `${target.name} removed from the active view.`, time: "Just now" }, ...current].slice(0, 4));
      toast.success("Category deleted", { className: "luxury-toast" });
      setConfirmAction({ type: "delete", category: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete category", { className: "luxury-toast" });
    }
  };

  const toggleVisibility = (category: CategoryRecord) => {
    const nextVisibility = category.visibility === "PUBLIC" ? "HIDDEN" : "PUBLIC";
    const updated = { ...category, visibility: nextVisibility, updatedAt: new Date().toISOString() };
    setCategories((current) => current.map((item) => (item.id === category.id ? updated : item)));
    setActivity((current) => [{ id: Date.now(), title: "Visibility updated", detail: `${category.name} is now ${nextVisibility.toLowerCase()}.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Visibility updated", { className: "luxury-toast" });
  };

  const toggleFeatured = (category: CategoryRecord) => {
    const updated = { ...category, featured: !category.featured, updatedAt: new Date().toISOString() };
    setCategories((current) => current.map((item) => (item.id === category.id ? updated : item)));
    setActivity((current) => [{ id: Date.now(), title: "Featured updated", detail: `${category.name} featured state changed.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Feature state updated", { className: "luxury-toast" });
  };

  const duplicateCategory = (category: CategoryRecord) => {
    const duplicate = {
      ...category,
      id: Date.now(),
      name: `${category.name} Copy`,
      slug: `${category.slug}-copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCategories((current) => [duplicate, ...current]);
    setActivity((current) => [{ id: Date.now(), title: "Category duplicated", detail: `${category.name} copied for a new collection.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Category duplicated", { className: "luxury-toast" });
  };

  const archiveCategory = (category: CategoryRecord) => {
    const updated = { ...category, status: "ARCHIVED", updatedAt: new Date().toISOString() };
    setCategories((current) => current.map((item) => (item.id === category.id ? updated : item)));
    setActivity((current) => [{ id: Date.now(), title: "Category archived", detail: `${category.name} moved to the archived view.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Category archived", { className: "luxury-toast" });
  };

  const handleExport = () => {
    const payload = JSON.stringify(categories, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "categories-export.json";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Category export generated", { className: "luxury-toast" });
  };

  const triggerImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (!Array.isArray(parsed)) throw new Error("Expected a JSON array.");
          const next = parsed.map((item, index) => ({
            ...item,
            id: item.id ?? Date.now() + index,
            slug: item.slug || slugify(item.name || `collection-${index + 1}`),
            productCount: item.productCount ?? 12,
            revenueShare: item.revenueShare ?? 10,
            status: item.status || "ACTIVE",
            visibility: item.visibility || "PUBLIC",
            featured: Boolean(item.featured),
            color: item.color || "#D4AF37",
            updatedAt: new Date().toISOString(),
          }));
          setCategories(next);
          toast.success("Categories imported", { className: "luxury-toast" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed", { className: "luxury-toast" });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleGenerateSeo = () => {
    setDraft((current) => ({
      ...current,
      seoTitle: current.name ? `${current.name} — House of Valerion` : current.seoTitle,
      seoDescription: current.description ? `${current.description.slice(0, 140)}...` : current.seoDescription,
    }));
    toast.success("SEO summary generated", { className: "luxury-toast" });
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-[#E5E7EB]/75 bg-white p-6 shadow-[0_24px_72px_-34px_rgba(4,30,66,0.34)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">House of Valerion</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[#041E42]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Category management</h2>
            <p className="mt-3 text-sm leading-7 text-[#64748B]">{isParentContext ? "Parent context • Read only. Inspect category data across active child stores." : "Maintain and organize luxury collections across the catalogue with a precise, executive-grade control surface."}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isParentContext && <button type="button" onClick={openCreateComposer} className="inline-flex items-center gap-2 rounded-full bg-[#041E42] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#09295D]">
              <Plus className="h-4 w-4" />
              Add category
            </button>}
            <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {heroMetrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * index }} whileHover={{ y: -3, scale: 1.01 }} className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.32em] text-[#64748B]">{item.label}</p>
                    <p className="mt-3 text-2xl font-semibold text-[#041E42]">{item.value}</p>
                  </div>
                  <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#FFF8E8] p-2.5 text-[#D4AF37]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#64748B]">{item.helper}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelCard title="Category distribution" subtitle="A refined view of the living category portfolio.">
          <div className="space-y-4">
            {shareData.length ? shareData.map((item, index) => (
              <div key={item.name} className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-semibold text-[#041E42]">{item.name}</p>
                      <p className="text-xs text-[#64748B]">{categories.find((entry) => entry.name === item.name)?.productCount ?? 0} products</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-[#041E42]">{item.value}%</p>
                </div>
                <div className="mt-3">
                  <ProgressBar value={item.value} color={item.color} />
                </div>
              </div>
            )) : (
              <div className="rounded-[20px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] p-6 text-sm text-[#64748B]">No category metrics yet.</div>
            )}
          </div>
        </PanelCard>

        <PanelCard title="Catalogue mix" subtitle="Healthy, draft and archived category balance.">
          <DonutChart data={distributionData} />
        </PanelCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelCard title="Revenue share" subtitle="Premium distribution by category strength.">
          <div className="space-y-4">
            {shareData.map((item, index) => (
              <div key={item.name} className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#041E42]">{item.name}</p>
                    <p className="text-xs text-[#64748B]">{index + 1} / {shareData.length}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#041E42]">{item.value}%</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.value}%` }} transition={{ duration: 0.6, delay: index * 0.06 }} className="h-full rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Operational signals" subtitle="Recent activity frames the current category state.">
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#041E42]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#64748B]">{item.detail}</p>
                  </div>
                  <span className="text-xs text-[#64748B]">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_24px_72px_-34px_rgba(4,30,66,0.34)] xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Search className="h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" className="w-full bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Filter className="h-4 w-4" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none">
              <option value="all">Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Eye className="h-4 w-4" />
            <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value)} className="bg-transparent outline-none">
              <option value="all">Visibility</option>
              <option value="PUBLIC">Public</option>
              <option value="HIDDEN">Hidden</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <BarChart3 className="h-4 w-4" />
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="bg-transparent outline-none">
              <option value="all">Product count</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resetFilters} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Reset</button>
          {!isParentContext && <button type="button" onClick={triggerImport} className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
            <Upload className="h-4 w-4" />
            Import
          </button>}
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
            <Download className="h-4 w-4" />
            Export
          </button>
          {!isParentContext && <button type="button" onClick={openCreateComposer} className="inline-flex items-center gap-2 rounded-full bg-[#041E42] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#09295D]">
            <Plus className="h-4 w-4" />
            Add category
          </button>}
        </div>
      </div>

      {filteredCategories.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-[#E5E7EB] bg-white p-10 text-center shadow-[0_24px_72px_-34px_rgba(4,30,66,0.34)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF8E8] text-[#D4AF37]">
            <Sparkles className="h-8 w-8" />
          </div>
          <h3 className="mt-5 text-2xl font-semibold text-[#041E42]">No categories yet</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#64748B]">Create a premium collection to define the next luxury edit for your storefront.</p>
          {!isParentContext && <button type="button" onClick={openCreateComposer} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#041E42] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#09295D]">
            <Plus className="h-4 w-4" />
            Create category
          </button>}
        </motion.div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.65fr]">
          <section className="overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_24px_72px_-34px_rgba(4,30,66,0.34)]">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-left text-[#64748B]">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Category</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Products</th>
                    <th className="px-4 py-4 font-semibold">Revenue</th>
                    <th className="px-4 py-4 font-semibold">Visibility</th>
                    <th className="px-4 py-4 font-semibold">Updated</th>
                    <th className="px-4 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="border-t border-[#E5E7EB] bg-white transition hover:bg-[#FFF8E8]">
                      <td className="px-4 py-4">
                        <div className={`flex items-center gap-3 ${category.parentId != null ? "ml-5 border-l-2 border-[#D4AF37] pl-3" : ""}`}>
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] text-sm font-semibold text-[#041E42]" style={{ backgroundColor: `${category.color || "#D4AF37"}16` }}>
                            {category.name?.charAt(0).toUpperCase() || "C"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#041E42]">{category.name}</p>
                            <p className="mt-1 truncate text-xs text-[#64748B]">{category.slug}</p>
                            {category.parentId != null ? <p className="mt-1 truncate text-[11px] text-[#64748B]">Subcategory of {category.parent?.name || categories.find((item) => item.id === category.parentId)?.name || "Parent category"}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(category.status)}`}>{category.status || "ACTIVE"}</span>
                      </td>
                      <td className="px-4 py-4 text-[#041E42]">{category.productCount ?? 0}</td>
                      <td className="px-4 py-4 text-[#041E42]">{category.revenueShare ?? 0}%</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getVisibilityTone(category.visibility)}`}>{category.visibility || "PUBLIC"}</span>
                      </td>
                      <td className="px-4 py-4 text-[#64748B]">{formatDate(category.updatedAt)}</td>
                      <td className="px-4 py-4">
                        {!isParentContext && <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEditComposer(category)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Edit">
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => toggleVisibility(category)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Toggle visibility">
                            {category.visibility === "PUBLIC" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button type="button" onClick={() => toggleFeatured(category)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Toggle feature">
                            <Star className={`h-4 w-4 ${category.featured ? "fill-[#D4AF37] text-[#D4AF37]" : ""}`} />
                          </button>
                          <button type="button" onClick={() => duplicateCategory(category)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Duplicate">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => archiveCategory(category)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Archive">
                            <Archive className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setConfirmAction({ type: "delete", category })} className="rounded-full border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="space-y-6">
            <PanelCard title="Quick actions" subtitle="Direct control over the active catalogue.">
              <div className="grid gap-2">
                {[
                  { label: "Create category", icon: Plus, onClick: openCreateComposer },
                  { label: "Import categories", icon: Upload, onClick: triggerImport },
                  { label: "Export catalogue", icon: Download, onClick: handleExport },
                  { label: "Generate SEO", icon: Sparkles, onClick: handleGenerateSeo },
                ].filter((action) => !isParentContext || action.label === "Export catalogue").map((action) => {
                  const Icon = action.icon;
                  return (
                    <button key={action.label} type="button" onClick={action.onClick} className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-left text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                      <span>{action.label}</span>
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </PanelCard>

            <PanelCard title="Recent activity" subtitle="Latest category actions and updates.">
              <div className="space-y-3">
                {activity.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                    <p className="text-sm font-semibold text-[#041E42]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#64748B]">{item.detail}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#64748B]">{item.time}</p>
                  </div>
                ))}
              </div>
            </PanelCard>
          </div>
        </div>
      )}

      <AnimatePresence>
        {composerOpen && !isParentContext ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#041E42]/70 px-4 py-8 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(4,30,66,0.45)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">Category editor</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#041E42]">{mode === "edit" ? "Update category" : "Create new category"}</h3>
                </div>
                <button type="button" onClick={closeComposer} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Cancel</button>
              </div>

              <form onSubmit={handleSave} className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-6">
                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#041E42]">Basic information</h4>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Category name</span>
                        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Slug</span>
                        <input value={draft.slug || slugify(draft.name)} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="md:col-span-2 text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Description</span>
                        <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Parent category</span>
                        <select value={draft.parentId} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value ? Number(event.target.value) : "" }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]">
                          <option value="">None / Root category</option>
                          {rootCategories.filter((category) => category.id !== selectedCategory?.id).map((category) => (
                            <option key={category.id} value={category.id} disabled={selectedCategoryHasChildren}>{category.name}</option>
                          ))}
                        </select>
                        {selectedCategoryHasChildren ? <p className="mt-2 text-xs text-[#64748B]">A category with subcategories must remain a root category.</p> : null}
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Sort order</span>
                        <input type="number" min="1" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 1) }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Display color</span>
                        <div className="flex items-center gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3">
                          <input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-[#E5E7EB] bg-transparent" />
                          <span className="text-sm text-[#64748B]">Luxury gold, navy or tailored accent.</span>
                        </div>
                      </label>
                      <div className="grid gap-2 rounded-[18px] border border-[#E5E7EB] bg-white p-3 text-sm text-[#64748B]">
                        <label className="flex items-center justify-between gap-2">
                          <span>Featured</span>
                          <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37]" />
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Visibility</span>
                          <select value={draft.visibility} onChange={(event) => setDraft((current) => ({ ...current, visibility: event.target.value }))} className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 outline-none">
                            <option value="PUBLIC">Public</option>
                            <option value="HIDDEN">Hidden</option>
                          </select>
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Status</span>
                          <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 outline-none">
                            <option value="ACTIVE">Active</option>
                            <option value="DRAFT">Draft</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <ImagePlus className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#041E42]">Media & SEO</h4>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Category image</span>
                        <div className="rounded-[18px] border border-dashed border-[#E5E7EB] bg-white p-3 text-center">
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingMedia.image} onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadCategoryImage(file, "image");
                            event.currentTarget.value = "";
                          }} className="w-full text-sm" />
                          {draft.iconPreview ? <img src={draft.iconPreview.startsWith("/uploads/") ? resolveAssetUrl(draft.iconPreview) : draft.iconPreview} alt="Category image preview" className="mx-auto mt-3 h-20 w-20 rounded-lg object-cover" /> : null}
                          {uploadingMedia.image ? <span className="mt-2 block text-xs">Uploading...</span> : null}
                        </div>
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Cover image</span>
                        <div className="rounded-[18px] border border-dashed border-[#E5E7EB] bg-white p-3 text-center">
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingMedia.coverImage} onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadCategoryImage(file, "coverImage");
                            event.currentTarget.value = "";
                          }} className="w-full text-sm" />
                          {draft.coverPreview ? <img src={draft.coverPreview.startsWith("/uploads/") ? resolveAssetUrl(draft.coverPreview) : draft.coverPreview} alt="Category cover preview" className="mt-3 h-20 w-full rounded-lg object-cover" /> : null}
                          {uploadingMedia.coverImage ? <span className="mt-2 block text-xs">Uploading...</span> : null}
                        </div>
                      </label>
                      <label className="md:col-span-2 text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Meta title</span>
                        <input value={draft.seoTitle} onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="md:col-span-2 text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Meta description</span>
                        <textarea value={draft.seoDescription} onChange={(event) => setDraft((current) => ({ ...current, seoDescription: event.target.value }))} rows={3} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="md:col-span-2 text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#041E42]">Keywords</span>
                        <input value={draft.keywords} onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                    </div>
                    <button type="button" onClick={handleGenerateSeo} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                      <Sparkles className="h-4 w-4" />
                      Generate SEO
                    </button>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#041E42]">Live preview</h4>
                    </div>
                    <div className="mt-4">
                      <CategoryPreviewCard category={{
                        id: selectedCategory?.id ?? Date.now(),
                        name: draft.name || "Category preview",
                        slug: draft.slug || slugify(draft.name || "category-preview"),
                        description: draft.description || "Luxury category crafted for premium discovery.",
                        productCount: selectedCategory?.productCount ?? 24,
                        revenueShare: selectedCategory?.revenueShare ?? 18,
                        status: draft.status as CategoryRecord["status"],
                        visibility: draft.visibility as CategoryRecord["visibility"],
                        featured: draft.featured,
                        color: draft.color,
                        parentCategory: draft.parentCategory,
                        sortOrder: draft.sortOrder,
                        seoTitle: draft.seoTitle || "",
                        seoDescription: draft.seoDescription || "",
                        keywords: draft.keywords.split(",").map((item) => item.trim()).filter(Boolean),
                      }} />
                    </div>
                  </section>
                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <h4 className="text-lg font-semibold text-[#041E42]">Actions</h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="submit" disabled={saving || uploadingMedia.image || uploadingMedia.coverImage} className="rounded-full bg-[#041E42] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#09295D] disabled:opacity-60">
                        {saving ? "Saving..." : uploadingMedia.image || uploadingMedia.coverImage ? "Uploading..." : mode === "edit" ? "Update" : "Create"}
                      </button>
                      <button type="button" onClick={closeComposer} disabled={uploadingMedia.image || uploadingMedia.coverImage} className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8] disabled:opacity-60">Cancel</button>
                    </div>
                  </section>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction.category && !isParentContext ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#041E42]/70 px-4 py-8 backdrop-blur-sm">
            <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="w-full max-w-md rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(4,30,66,0.45)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">Confirm action</p>
              <h3 className="mt-3 text-xl font-semibold text-[#041E42]">Delete {confirmAction.category.name}?</h3>
              <p className="mt-3 text-sm leading-7 text-[#64748B]">This will remove the category from the catalogue view. The action can be reversed from the activity feed or by re-creating the collection.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmAction({ type: "delete", category: null })} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2 text-sm font-semibold text-[#041E42] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Cancel</button>
                <button type="button" onClick={() => confirmAction.category && handleDelete(confirmAction.category.id)} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function UsersPage() {
  const { isParentContext } = useAdminContext();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAdmin("/users");
        setUsers(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load users");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        normalized.length === 0 ||
        user.name?.toLowerCase().includes(normalized) ||
        user.email?.toLowerCase().includes(normalized);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, query, roleFilter]);

  const handleUpdateRole = async (userId: number, role: string) => {
    if (isParentContext) return;
    try {
      setSaving(true);
      const updated = await fetchAdmin(`/users/${userId}`, { method: "PUT", body: JSON.stringify({ role }) });
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
      setSelected((current) => (current?.id === userId ? updated : current));
      toast.success("User role updated", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update user", { className: "luxury-toast" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (isParentContext) return;
    if (!window.confirm("Delete this user and all associated orders?")) return;
    try {
      await fetchAdmin(`/users/${userId}`, { method: "DELETE" });
      setUsers((current) => current.filter((user) => user.id !== userId));
      if (selected?.id === userId) setSelected(null);
      toast.success("User removed", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete user", { className: "luxury-toast" });
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">User roster</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Users</h2>
            {isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#A16207]">Parent context • Read only</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="sr-only">Search users</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email"
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>
            <label className="block">
              <span className="sr-only">Role filter</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="all">All roles</option>
                <option value="ADMIN">Admin</option>
                <option value="CUSTOMER">Customer</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState title="No users found" description="Try changing your filters or add a new account through the backend." />
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Orders</th>
                  <th className="py-3 pr-4">Joined</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA]">
                    <td className="py-3 pr-4 font-medium text-[#111111]">{user.name || `User ${user.id}`}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{user.email}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{user.orders ?? 0} / {withCurrency(user.totalSpend ?? 0)}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{user.role || "CUSTOMER"}</td>
                    <td className="py-3 pr-4 text-[#4B5563]">{formatDate(user.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelected(user)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          View
                        </button>
                        {!isParentContext && <button
                          type="button"
                          onClick={() => handleUpdateRole(user.id, user.role === "ADMIN" ? "CUSTOMER" : "ADMIN")}
                          disabled={saving}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                        >
                          Toggle role
                        </button>}
                        {!isParentContext && <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected ? (
        <section className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Selected user</p>
              <h3 className="mt-2 text-lg font-semibold text-[#041E42]">{selected.name || `User ${selected.id}`}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#041E42] hover:bg-[#FFF8E8]"
            >
              Close
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-[#041E42]">Email</p>
              <p className="mt-1 text-sm text-[#4B5563]">{selected.email}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#041E42]">Role</p>
              <p className="mt-1 text-sm text-[#4B5563]">{selected.role}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#041E42]">Joined</p>
              <p className="mt-1 text-sm text-[#4B5563]">{formatDate(selected.createdAt)}</p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function couponStatus(coupon: CouponRecord, now: Date) {
  if (!coupon.active) return "Inactive";
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return "Scheduled";
  if (coupon.endsAt && new Date(coupon.endsAt) < now) return "Expired";
  return "Active";
}

function couponStatusStyle(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
  if (status === "Scheduled") return "bg-sky-50 text-sky-700 ring-sky-600/15";
  if (status === "Expired") return "bg-slate-100 text-slate-600 ring-slate-500/15";
  return "bg-amber-50 text-amber-700 ring-amber-600/15";
}

function couponValidity(coupon: CouponRecord) {
  if (!coupon.startsAt && !coupon.endsAt) return "No date limits";
  const start = coupon.startsAt ? formatDate(coupon.startsAt) : "No start date";
  const end = coupon.endsAt ? formatDate(coupon.endsAt) : "No end date";
  return `${start} → ${end}`;
}

function formatCouponCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

async function fetchCouponList() {
  const response = await fetchAdmin("/coupons");
  if (!Array.isArray(response)) throw new Error("Unexpected coupons response");
  return response as CouponRecord[];
}

function couponFormFromRecord(coupon?: CouponRecord | null): CouponFormValues {
  const toLocalDateTime = (value: string | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };

  return {
    code: coupon?.code || "",
    discountType: coupon?.discountType.toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
    value: coupon ? String(coupon.value) : "",
    maxDiscount: coupon?.maxDiscount == null ? "" : String(coupon.maxDiscount),
    minOrderValue: coupon?.minOrderValue == null ? "" : String(coupon.minOrderValue),
    maxOrderValue: coupon?.maxOrderValue == null ? "" : String(coupon.maxOrderValue),
    usageLimit: coupon?.usageLimit == null ? "" : String(coupon.usageLimit),
    userUsageLimit: coupon?.userUsageLimit == null ? "" : String(coupon.userUsageLimit),
    startsAt: toLocalDateTime(coupon?.startsAt),
    endsAt: toLocalDateTime(coupon?.endsAt),
    allowFreeShipping: coupon?.allowFreeShipping ?? false,
    active: coupon?.active ?? true,
    productIds: coupon?.productIds || [],
    categoryIds: coupon?.categoryIds || [],
  };
}

function validateCouponForm(form: CouponFormValues) {
  const errors: Partial<Record<keyof CouponFormValues, string>> = {};
  const optionalNumbers: Array<[keyof CouponFormValues, string, boolean]> = [
    ["maxDiscount", "Maximum discount", false],
    ["minOrderValue", "Minimum order value", false],
    ["maxOrderValue", "Maximum order value", false],
    ["usageLimit", "Total usage limit", true],
    ["userUsageLimit", "Per-customer usage limit", true],
  ];

  if (!form.code.trim()) errors.code = "Coupon code is required.";
  const value = Number(form.value);
  if (!form.value.trim() || !Number.isFinite(value) || value <= 0) {
    errors.value = "Enter a discount value greater than zero.";
  } else if (form.discountType === "PERCENTAGE" && value > 100) {
    errors.value = "Percentage discounts cannot exceed 100%.";
  }

  for (const [field, label, integer] of optionalNumbers) {
    const rawValue = form[field] as string;
    if (!rawValue.trim()) continue;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue) || numericValue < 0 || (integer && !Number.isInteger(numericValue))) {
      errors[field] = integer ? `${label} must be a non-negative whole number.` : `${label} must be zero or greater.`;
    }
  }

  if (form.minOrderValue.trim() && form.maxOrderValue.trim()
    && Number(form.maxOrderValue) <= Number(form.minOrderValue)) {
    errors.maxOrderValue = "Maximum order value must be greater than the minimum.";
  }
  if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
    errors.endsAt = "End date and time must be later than the start.";
  }
  return errors;
}

function CouponEditorDialog({
  open,
  coupon,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  coupon: CouponRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<boolean>;
}) {
  const [form, setForm] = useState<CouponFormValues>(() => couponFormFromRecord(coupon));
  const [errors, setErrors] = useState<Partial<Record<keyof CouponFormValues, string>>>({});
  const [notice, setNotice] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionError, setOptionError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(couponFormFromRecord(coupon));
    setErrors({});
    setNotice("");
    setSubmitError("");
  }, [coupon, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingOptions(true);
    setOptionError("");
    Promise.allSettled([fetchAdmin("/products"), fetchAdmin("/categories")]).then(([productResult, categoryResult]) => {
      if (cancelled) return;
      if (productResult.status === "fulfilled" && Array.isArray(productResult.value)) {
        setProducts(productResult.value as ProductRecord[]);
      } else {
        setOptionError("Product options could not be loaded.");
      }
      if (categoryResult.status === "fulfilled" && Array.isArray(categoryResult.value)) {
        setCategories(categoryResult.value as CategoryRecord[]);
      } else {
        setOptionError((current) => current ? `${current} Category options could not be loaded.` : "Category options could not be loaded.");
      }
      setLoadingOptions(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  const updateField = <K extends keyof CouponFormValues>(field: K, value: CouponFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
    setSubmitError("");
  };

  const toggleSelection = (field: "productIds" | "categoryIds", id: number) => {
    const selected = form[field];
    updateField(field, selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    const normalizedForm = { ...form, code: form.code.trim().toUpperCase() };
    const validationErrors = validateCouponForm(normalizedForm);
    setForm(normalizedForm);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setNotice("Review the highlighted fields before saving.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setNotice("");
    setSubmitError("");
    const initialForm = couponFormFromRecord(coupon);
    const optionalNumber = (value: string) => value.trim() ? Number(value) : null;
    const dateValue = (value: string, initialValue: string, originalIso: string | null) => {
      if (coupon && value === initialValue) return originalIso;
      return value ? new Date(value).toISOString() : null;
    };
    const payload = {
      code: normalizedForm.code,
      discountType: normalizedForm.discountType,
      value: Number(normalizedForm.value),
      active: normalizedForm.active,
      usageLimit: optionalNumber(normalizedForm.usageLimit),
      userUsageLimit: optionalNumber(normalizedForm.userUsageLimit),
      minOrderValue: optionalNumber(normalizedForm.minOrderValue),
      maxOrderValue: optionalNumber(normalizedForm.maxOrderValue),
      maxDiscount: normalizedForm.discountType === "PERCENTAGE"
        ? optionalNumber(normalizedForm.maxDiscount)
        : coupon?.discountType.toUpperCase() === "FIXED" ? coupon.maxDiscount : null,
      allowFreeShipping: normalizedForm.allowFreeShipping,
      startsAt: dateValue(normalizedForm.startsAt, initialForm.startsAt, coupon?.startsAt ?? null),
      endsAt: dateValue(normalizedForm.endsAt, initialForm.endsAt, coupon?.endsAt ?? null),
      productIds: [...normalizedForm.productIds],
      categoryIds: [...normalizedForm.categoryIds],
    };

    try {
      await fetchAdmin(coupon ? `/coupons/${coupon.id}` : "/coupons", {
        method: coupon ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const refreshed = await onSaved();
      onOpenChange(false);
      toast.success(coupon ? "Coupon updated" : "Coupon created", { className: "luxury-toast" });
      if (!refreshed) toast.error("Coupon saved, but the list could not refresh.", { className: "luxury-toast" });
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : "Unable to save coupon");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const inputClassName = "mt-1.5 h-11 w-full rounded-[10px] border border-[#D0D5DD] bg-white px-3.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15";
  const fieldError = (field: keyof CouponFormValues) => errors[field]
    ? <p role="alert" className="mt-1.5 text-xs font-medium text-rose-700">{errors[field]}</p>
    : null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (savingRef.current && !nextOpen) return;
      onOpenChange(nextOpen);
    }}>
      <DialogContent className="block max-h-[92vh] max-w-4xl overflow-y-auto rounded-[16px] border-[#E6E8EC] p-0">
        <div className="border-b border-[#EAECF0] px-5 py-5 sm:px-7">
          <DialogHeader className="pr-8 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#A77E14]">Coupon setup</p>
            <DialogTitle className="mt-1 text-xl text-[#041E42]">{coupon ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-[#667085]">Configure the offer, eligibility, and usage window.</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-7 px-5 py-6 sm:px-7">
            <section className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#101828]">Basic details</h3>
                <p className="mt-1 text-xs text-[#667085]">Set a recognizable code for this promotion.</p>
              </div>
              <div className="grid gap-4">
                <label className="block text-sm font-medium text-[#344054]">
                  Coupon code <span className="text-rose-600">*</span>
                  <input autoComplete="off" value={form.code} onChange={(event) => updateField("code", event.target.value)} onBlur={() => updateField("code", form.code.trim().toUpperCase())} placeholder="e.g. VALERION10" aria-invalid={Boolean(errors.code)} className={`${inputClassName} ${errors.code ? "border-rose-400" : ""}`} />
                  {fieldError("code")}
                </label>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <div><h3 className="text-sm font-semibold text-[#101828]">Discount configuration</h3><p className="mt-1 text-xs text-[#667085]">Choose the discount calculation and any percentage cap.</p></div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm font-medium text-[#344054]">Discount type<select value={form.discountType} onChange={(event) => updateField("discountType", event.target.value as CouponFormValues["discountType"])} className={inputClassName}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select></label>
                <label className="block text-sm font-medium text-[#344054]">Discount value <span className="text-rose-600">*</span><div className="relative"><input type="number" min="0.01" step="0.01" value={form.value} onChange={(event) => updateField("value", event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.value)} className={`${inputClassName} pr-12 ${errors.value ? "border-rose-400" : ""}`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#667085]">{form.discountType === "PERCENTAGE" ? "%" : "INR"}</span></div>{fieldError("value")}</label>
                <label className="block text-sm font-medium text-[#344054]">Maximum discount<input type="number" min="0" step="0.01" value={form.maxDiscount} onChange={(event) => updateField("maxDiscount", event.target.value)} disabled={form.discountType !== "PERCENTAGE"} placeholder="No cap" className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-[#F2F4F7]`} />{fieldError("maxDiscount")}</label>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <div><h3 className="text-sm font-semibold text-[#101828]">Order eligibility</h3><p className="mt-1 text-xs text-[#667085]">Optionally limit the order subtotal this offer can be used with.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-[#344054]">Minimum order value<input type="number" min="0" step="0.01" value={form.minOrderValue} onChange={(event) => updateField("minOrderValue", event.target.value)} placeholder="No minimum" className={inputClassName} />{fieldError("minOrderValue")}</label>
                <label className="block text-sm font-medium text-[#344054]">Maximum order value<input type="number" min="0" step="0.01" value={form.maxOrderValue} onChange={(event) => updateField("maxOrderValue", event.target.value)} placeholder="No maximum" aria-invalid={Boolean(errors.maxOrderValue)} className={`${inputClassName} ${errors.maxOrderValue ? "border-rose-400" : ""}`} />{fieldError("maxOrderValue")}</label>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <div><h3 className="text-sm font-semibold text-[#101828]">Product and category restrictions</h3><p className="mt-1 text-xs text-[#667085]">Leave both lists unselected to apply this coupon to all products.</p></div>
              {loadingOptions ? <div className="h-36 animate-pulse rounded-[12px] bg-[#F2F4F7]" aria-live="polite" /> : optionError ? <p role="alert" className="text-sm text-rose-700">{optionError}</p> : (
                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="min-w-0 rounded-[12px] border border-[#E5E7EB] p-3"><legend className="px-1 text-xs font-semibold text-[#344054]">Products</legend><div className="max-h-44 space-y-1 overflow-y-auto">{products.map((product) => <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2 text-sm text-[#344054] hover:bg-[#F8FAFC]"><input type="checkbox" checked={form.productIds.includes(product.id)} onChange={() => toggleSelection("productIds", product.id)} className="h-4 w-4 accent-[#08182F]" /><span className="min-w-0 truncate">{product.name || `Product ${product.id}`}</span></label>)}</div>{products.length === 0 && <p className="p-2 text-xs text-[#667085]">No products available.</p>}</fieldset>
                  <fieldset className="min-w-0 rounded-[12px] border border-[#E5E7EB] p-3"><legend className="px-1 text-xs font-semibold text-[#344054]">Categories</legend><div className="max-h-44 space-y-1 overflow-y-auto">{categories.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-2 text-sm text-[#344054] hover:bg-[#F8FAFC]"><input type="checkbox" checked={form.categoryIds.includes(category.id)} onChange={() => toggleSelection("categoryIds", category.id)} className="h-4 w-4 accent-[#08182F]" /><span className="min-w-0 truncate">{category.name || `Category ${category.id}`}</span></label>)}</div>{categories.length === 0 && <p className="p-2 text-xs text-[#667085]">No categories available.</p>}</fieldset>
                </div>
              )}
              <p className="text-xs text-[#667085]">{form.productIds.length} products · {form.categoryIds.length} categories selected</p>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <div><h3 className="text-sm font-semibold text-[#101828]">Usage limits</h3><p className="mt-1 text-xs text-[#667085]">Leave a limit blank to allow unlimited use.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-[#344054]">Total usage limit<input type="number" min="0" step="1" value={form.usageLimit} onChange={(event) => updateField("usageLimit", event.target.value)} placeholder="Unlimited" className={inputClassName} />{fieldError("usageLimit")}</label>
                <label className="block text-sm font-medium text-[#344054]">Per-customer usage limit<input type="number" min="0" step="1" value={form.userUsageLimit} onChange={(event) => updateField("userUsageLimit", event.target.value)} placeholder="Unlimited" className={inputClassName} />{fieldError("userUsageLimit")}</label>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <div><h3 className="text-sm font-semibold text-[#101828]">Schedule</h3><p className="mt-1 text-xs text-[#667085]">Leave blank for no date limit.</p></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-[#344054]">Start date and time<input type="datetime-local" value={form.startsAt} onChange={(event) => updateField("startsAt", event.target.value)} className={inputClassName} /></label>
                <label className="block text-sm font-medium text-[#344054]">End date and time<input type="datetime-local" value={form.endsAt} onChange={(event) => updateField("endsAt", event.target.value)} aria-invalid={Boolean(errors.endsAt)} className={`${inputClassName} ${errors.endsAt ? "border-rose-400" : ""}`} />{fieldError("endsAt")}</label>
              </div>
            </section>

            <section className="space-y-4 border-t border-[#EAECF0] pt-6">
              <h3 className="text-sm font-semibold text-[#101828]">Additional settings</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {([["allowFreeShipping", "Allow free shipping"], ["active", "Coupon is active"]] as const).map(([field, label]) => <div key={field} className="flex items-center justify-between gap-4 rounded-[12px] border border-[#E5E7EB] px-4 py-3"><span className="text-sm font-medium text-[#344054]">{label}</span><Switch checked={form[field]} onCheckedChange={(checked) => updateField(field, checked)} aria-label={label} /></div>)}
              </div>
            </section>

            {notice && <p role={Object.keys(errors).length ? "alert" : "status"} className={`rounded-[10px] px-3.5 py-3 text-sm ${Object.keys(errors).length ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{notice}</p>}
            {submitError && <p role="alert" className="rounded-[10px] bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{submitError}</p>}
          </div>
          <DialogFooter className="sticky bottom-0 flex-row justify-end gap-2 border-t border-[#EAECF0] bg-white px-5 py-4 sm:px-7">
            <button type="button" disabled={saving} onClick={() => onOpenChange(false)} className="inline-flex h-10 items-center justify-center rounded-[10px] border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F8FAFC] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-[#08182F] px-5 text-sm font-semibold text-white transition hover:bg-[#122744] disabled:opacity-60">{saving && <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? "Saving..." : "Save coupon"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CouponsPage() {
  const { isParentContext } = useAdminContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRecord | null>(null);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [validityDateFilter, setValidityDateFilter] = useState("all");
  const [createdDateFilter, setCreatedDateFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState<{ couponId: number; action: "toggle" | "delete" } | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<CouponRecord | null>(null);
  const [actionError, setActionError] = useState<{ couponId: number; message: string } | null>(null);
  const actionPendingRef = useRef(false);
  const now = new Date();
  const hasFilters = Boolean(searchTerm || statusFilter !== "all" || typeFilter !== "all" || validityDateFilter !== "all" || createdDateFilter !== "all");

  useEffect(() => {
    let cancelled = false;
    const loadCoupons = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetchCouponList();
        if (!cancelled) setCoupons(response);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load coupons");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadCoupons();
    return () => { cancelled = true; };
  }, [retryCount]);

  const filteredCoupons = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    const getDateRange = (filter: string) => {
      if (filter === "30-days") {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        return { start, end: now };
      }
      if (filter === "this-month") {
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999) };
      }
      return null;
    };
    const validityDateRange = getDateRange(validityDateFilter);
    const createdDateRange = getDateRange(createdDateFilter);
    return coupons.filter((coupon) => {
      const status = couponStatus(coupon, now);
      const matchesSearch = !normalizedQuery || coupon.code.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || status.toLowerCase() === statusFilter;
      const matchesType = typeFilter === "all" || coupon.discountType.toLowerCase() === typeFilter;
      const startsAt = coupon.startsAt ? new Date(coupon.startsAt) : null;
      const endsAt = coupon.endsAt ? new Date(coupon.endsAt) : null;
      const matchesValidityDate = !validityDateRange || ((!startsAt || startsAt <= validityDateRange.end) && (!endsAt || endsAt >= validityDateRange.start));
      const createdAt = typeof coupon.createdAt === "string" ? new Date(coupon.createdAt) : null;
      const matchesCreatedDate = !createdDateRange || (
        createdAt !== null
        && Number.isFinite(createdAt.getTime())
        && createdAt >= createdDateRange.start
        && createdAt <= createdDateRange.end
      );
      return matchesSearch && matchesStatus && matchesType && matchesValidityDate && matchesCreatedDate;
    });
  }, [coupons, createdDateFilter, searchTerm, statusFilter, typeFilter, validityDateFilter]);

  const totalUses = coupons.reduce((total, coupon) => total + (Number(coupon.usageCount) || 0), 0);
  const activeCoupons = coupons.filter((coupon) => couponStatus(coupon, now) === "Active").length;
  const metrics = [
    { label: "Total coupons", value: coupons.length.toLocaleString("en-IN"), icon: Tag, tone: "bg-[#F7F4EA] text-[#9A7616]" },
    { label: "Active coupons", value: activeCoupons.toLocaleString("en-IN"), icon: CheckCircle2, tone: "bg-[#EDF6F2] text-[#287354]" },
    { label: "Total uses", value: totalUses.toLocaleString("en-IN"), icon: TrendingUp, tone: "bg-[#EEF3F8] text-[#365B7C]" },
    { label: "Total discount given", value: "Unavailable", helper: "Discount totals are not returned by this API", icon: CircleDollarSign, tone: "bg-[#F6F0F4] text-[#80536D]" },
  ];

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setValidityDateFilter("all");
    setCreatedDateFilter("all");
  };
  const openEditor = (coupon: CouponRecord | null = null) => {
    setEditingCoupon(coupon);
    setCreateOpen(true);
  };
  const refreshCoupons = async () => {
    setLoading(true);
    setError("");
    try {
      setCoupons(await fetchCouponList());
      return true;
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load coupons");
      return false;
    } finally {
      setLoading(false);
    }
  };
  const handleToggle = async (coupon: CouponRecord, active: boolean) => {
    if (isParentContext || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setPendingAction({ couponId: coupon.id, action: "toggle" });
    setActionError(null);
    try {
      await fetchAdmin(`/coupons/${coupon.id}`, { method: "PUT", body: JSON.stringify({ active }) });
      const refreshed = await refreshCoupons();
      toast.success(active ? "Coupon activated" : "Coupon deactivated", { className: "luxury-toast" });
      if (!refreshed) toast.error("Coupon status was updated, but the list could not refresh.", { className: "luxury-toast" });
      if (couponToDelete?.id === coupon.id) setCouponToDelete(null);
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Unable to update coupon status";
      setActionError({ couponId: coupon.id, message });
      toast.error(message, { className: "luxury-toast" });
    } finally {
      actionPendingRef.current = false;
      setPendingAction(null);
    }
  };
  const handleDelete = async () => {
    const coupon = couponToDelete;
    if (!coupon || isParentContext || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setPendingAction({ couponId: coupon.id, action: "delete" });
    setActionError(null);
    try {
      await fetchAdmin(`/coupons/${coupon.id}`, { method: "DELETE" });
      setCouponToDelete(null);
      const refreshed = await refreshCoupons();
      toast.success("Coupon deleted", { className: "luxury-toast" });
      if (!refreshed) toast.error("Coupon was deleted, but the list could not refresh.", { className: "luxury-toast" });
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Unable to delete coupon";
      setActionError({ couponId: coupon.id, message });
      toast.error(message, { className: "luxury-toast" });
    } finally {
      actionPendingRef.current = false;
      setPendingAction(null);
    }
  };

  const selectClassName = "h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#344054] outline-none transition focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15";
  const renderEmptyState = () => (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F7F4EA] text-[#9A7616]"><Tag className="h-5 w-5" aria-hidden="true" /></span>
      <h2 className="mt-4 text-base font-semibold text-[#101828]">{coupons.length ? "No matching coupons" : "No coupons yet"}</h2>
      <p className="mt-1.5 text-sm leading-6 text-[#667085]">{coupons.length ? "Try changing your search or filters." : "Create your first coupon to start offering discounts to customers."}</p>
      {coupons.length ? <button type="button" onClick={clearFilters} className="mt-5 rounded-[10px] border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#344054] hover:border-[#C9A227]">Clear filters</button> : !isParentContext && <button type="button" onClick={() => openEditor()} className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-[#08182F] px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Create coupon</button>}
    </div>
  );

  return (
    <div className="min-w-0 space-y-6 py-4">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A77E14]">Marketing / Offers</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#041E42]">Coupons</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">Manage promotional codes, discounts, and customer offers.</p>{isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#A16207]">Parent context · Read only</p>}</div>
        {!isParentContext && <button type="button" onClick={() => openEditor()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#08182F] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(8,24,47,0.65)] transition hover:bg-[#122744]"><Plus className="h-4 w-4" />Create coupon</button>}
      </section>

      <section aria-label="Coupon summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, helper, icon: Icon, tone }) => <div key={label} className="flex min-h-[124px] items-center justify-between gap-4 rounded-[16px] border border-[#E6E8EC] bg-white p-5 shadow-[0_12px_32px_-24px_rgba(4,30,66,0.32)]"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]">{label}</p><p className="mt-3 text-2xl font-semibold text-[#101828]">{value}</p>{helper && <p className="mt-1 max-w-[210px] text-xs leading-5 text-[#667085]">{helper}</p>}</div><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span></div>)}
      </section>

      <section aria-label="Coupon filters" className="rounded-[16px] border border-[#E6E8EC] bg-white p-4 shadow-[0_12px_32px_-24px_rgba(4,30,66,0.28)] sm:p-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_repeat(4,minmax(140px,1fr))_auto]">
          <label className="relative block min-w-0 sm:col-span-2 xl:col-span-1"><span className="sr-only">Search coupons by code</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" aria-hidden="true" /><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search coupon codes..." className="h-11 w-full min-w-0 rounded-[12px] border border-[#E5E7EB] pl-10 pr-3.5 text-sm text-[#344054] outline-none focus:border-[#C9A227] focus:ring-2 focus:ring-[#C9A227]/15" /></label>
          <label><span className="sr-only">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClassName}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option><option value="scheduled">Scheduled</option></select></label>
          <label><span className="sr-only">Discount type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={selectClassName}><option value="all">All types</option><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></label>
          <label><span className="sr-only">Coupon validity dates</span><select value={validityDateFilter} onChange={(event) => setValidityDateFilter(event.target.value)} className={selectClassName}><option value="all">Any validity dates</option><option value="30-days">Valid in last 30 days</option><option value="this-month">Valid this month</option></select></label>
          <label><span className="sr-only">Coupon creation date</span><select value={createdDateFilter} onChange={(event) => setCreatedDateFilter(event.target.value)} className={selectClassName}><option value="all">Any creation date</option><option value="30-days">Created in last 30 days</option><option value="this-month">Created this month</option></select></label>
          <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#E5E7EB] px-3.5 text-sm font-medium text-[#475467] transition hover:border-[#C9A227] disabled:cursor-not-allowed disabled:opacity-45"><Filter className="h-4 w-4" aria-hidden="true" />Clear</button>
        </div>
      </section>

      {loading ? <section aria-label="Loading coupons" className="rounded-[16px] border border-[#E6E8EC] bg-white p-5"><div className="h-12 animate-pulse rounded-[12px] bg-[#F2F4F7]" /><div className="mt-5 h-64 animate-pulse rounded-[12px] bg-[#F2F4F7]" /></section> : error ? <section role="alert" className="flex flex-col items-start gap-4 rounded-[16px] border border-rose-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[#101828]">Unable to load coupons</h2><p className="mt-1 text-sm text-[#667085]">{error}</p></div><button type="button" onClick={() => setRetryCount((count) => count + 1)} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#E5E7EB] px-4 text-sm font-semibold text-[#344054]"><RefreshCw className="h-4 w-4" />Retry</button></section> : (
        <section aria-label="Coupons" className="overflow-hidden rounded-[16px] border border-[#E6E8EC] bg-white shadow-[0_12px_32px_-24px_rgba(4,30,66,0.32)]">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1120px] border-collapse text-left text-sm"><thead><tr className="border-b border-[#EAECF0] bg-[#FAFBFC] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#667085]"><th className="px-5 py-4">Code</th><th className="px-5 py-4">Restrictions</th><th className="px-5 py-4">Type</th><th className="px-5 py-4">Discount</th><th className="px-5 py-4">Min order</th><th className="px-5 py-4">Usage</th><th className="px-5 py-4">Validity</th><th className="px-5 py-4">Status</th>{!isParentContext && <th className="px-5 py-4">Actions</th>}</tr></thead><tbody>{filteredCoupons.length === 0 ? <tr><td colSpan={isParentContext ? 8 : 9} className="px-6 py-2">{renderEmptyState()}</td></tr> : filteredCoupons.map((coupon) => {
            const status = couponStatus(coupon, now);
            const restrictions = [coupon.productIds.length ? `${coupon.productIds.length} products` : "", coupon.categoryIds.length ? `${coupon.categoryIds.length} categories` : ""].filter(Boolean);
            return <tr key={coupon.id} className="border-b border-[#F2F4F7] last:border-0 transition hover:bg-[#FCFCFD]"><td className="whitespace-nowrap px-5 py-4 font-semibold text-[#101828]">{coupon.code}</td><td className="max-w-[220px] px-5 py-4 text-[#667085]">{restrictions.length ? restrictions.join(" · ") : "All products and categories"}</td><td className="whitespace-nowrap px-5 py-4 text-[#475467]">{coupon.discountType.toUpperCase() === "PERCENTAGE" ? "Percentage" : "Fixed"}</td><td className="whitespace-nowrap px-5 py-4 font-medium text-[#101828]">{coupon.discountType.toUpperCase() === "PERCENTAGE" ? `${coupon.value}%` : formatCouponCurrency(coupon.value)}</td><td className="whitespace-nowrap px-5 py-4 text-[#475467]">{coupon.minOrderValue == null ? "—" : formatCouponCurrency(coupon.minOrderValue)}</td><td className="whitespace-nowrap px-5 py-4 text-[#475467]">{coupon.usageCount} / {coupon.usageLimit == null ? "Unlimited" : coupon.usageLimit}</td><td className="whitespace-nowrap px-5 py-4 text-[#475467]">{couponValidity(coupon)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${couponStatusStyle(status)}`}>{status}</span></td>{!isParentContext && <td className="px-5 py-4"><div className="flex items-center gap-1.5"><button type="button" onClick={() => openEditor(coupon)} className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#344054] hover:border-[#C9A227]">Edit</button><button type="button" disabled={pendingAction !== null} onClick={() => void handleToggle(coupon, !coupon.active)} className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-50">{coupon.active ? "Deactivate" : "Activate"}</button><button type="button" disabled={pendingAction !== null} onClick={() => { setActionError(null); setCouponToDelete(coupon); }} className="rounded-[8px] border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Delete</button></div>{actionError?.couponId === coupon.id && <p role="alert" className="mt-2 max-w-64 text-xs leading-5 text-rose-700">{actionError.message}</p>}</td>}</tr>;
          })}</tbody></table></div>
          <div className="space-y-3 p-4 md:hidden">{filteredCoupons.length === 0 ? renderEmptyState() : filteredCoupons.map((coupon) => { const status = couponStatus(coupon, now); const restrictions = [coupon.productIds.length ? `${coupon.productIds.length} products` : "", coupon.categoryIds.length ? `${coupon.categoryIds.length} categories` : ""].filter(Boolean); return <article key={coupon.id} className="rounded-[12px] border border-[#EAECF0] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-[#101828]">{coupon.code}</h2><p className="mt-1 text-sm text-[#667085]">{restrictions.length ? restrictions.join(" · ") : "All products and categories"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${couponStatusStyle(status)}`}>{status}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-[#667085]">Discount</dt><dd className="font-medium text-[#101828]">{coupon.discountType.toUpperCase() === "PERCENTAGE" ? `${coupon.value}%` : formatCouponCurrency(coupon.value)}</dd></div><div><dt className="text-xs text-[#667085]">Usage</dt><dd className="font-medium text-[#101828]">{coupon.usageCount} / {coupon.usageLimit == null ? "Unlimited" : coupon.usageLimit}</dd></div><div><dt className="text-xs text-[#667085]">Minimum order</dt><dd className="font-medium text-[#101828]">{coupon.minOrderValue == null ? "—" : formatCouponCurrency(coupon.minOrderValue)}</dd></div><div><dt className="text-xs text-[#667085]">Validity</dt><dd className="font-medium text-[#101828]">{couponValidity(coupon)}</dd></div></dl>{!isParentContext && <div className="mt-4 flex flex-wrap gap-2 border-t border-[#F2F4F7] pt-3"><button type="button" onClick={() => openEditor(coupon)} className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#344054]">Edit</button><button type="button" disabled={pendingAction !== null} onClick={() => void handleToggle(coupon, !coupon.active)} className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1.5 text-xs font-medium text-[#344054] disabled:opacity-50">{coupon.active ? "Deactivate" : "Activate"}</button><button type="button" disabled={pendingAction !== null} onClick={() => { setActionError(null); setCouponToDelete(coupon); }} className="rounded-[8px] border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50">Delete</button></div>}{actionError?.couponId === coupon.id && <p role="alert" className="mt-2 text-xs text-rose-700">{actionError.message}</p>}</article>; })}</div>
        </section>
      )}

      {!isParentContext && <CouponEditorDialog open={createOpen} coupon={editingCoupon} onSaved={refreshCoupons} onOpenChange={(open) => { setCreateOpen(open); if (!open) setEditingCoupon(null); }} />}
      {!isParentContext && <Dialog open={couponToDelete !== null} onOpenChange={(open) => { if (actionPendingRef.current && !open) return; if (!open) setCouponToDelete(null); }}><DialogContent className="max-w-lg rounded-[16px] border-[#E6E8EC] p-6"><DialogHeader className="pr-7 text-left"><DialogTitle className="text-lg text-[#041E42]">Delete coupon {couponToDelete?.code}?</DialogTitle><DialogDescription className="pt-2 leading-6 text-[#667085]">This permanently removes the coupon if it has no usage history. Coupons that have been used cannot be deleted; deactivate them instead.</DialogDescription></DialogHeader>{couponToDelete && actionError?.couponId === couponToDelete.id && <p role="alert" className="rounded-[10px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{actionError.message}</p>}<DialogFooter className="mt-2 flex-col gap-2 sm:flex-row sm:justify-end">{couponToDelete?.active && <button type="button" disabled={pendingAction !== null} onClick={() => void handleToggle(couponToDelete, false)} className="h-10 rounded-[10px] border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] disabled:opacity-50">Deactivate instead</button>}<button type="button" disabled={pendingAction !== null} onClick={() => setCouponToDelete(null)} className="h-10 rounded-[10px] border border-[#D0D5DD] px-4 text-sm font-semibold text-[#344054] disabled:opacity-50">Cancel</button><button type="button" disabled={pendingAction !== null || !couponToDelete} onClick={() => void handleDelete()} className="h-10 rounded-[10px] bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50">{pendingAction?.action === "delete" ? "Deleting..." : "Delete coupon"}</button></DialogFooter></DialogContent></Dialog>}
    </div>
  );
}

function InventoryPage() {
  return <InventoryDashboard />;
}

function ReviewsPage() {
  const { isParentContext } = useAdminContext();
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAdmin("/reviews");
        setReviews(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load reviews");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesSearch =
        normalized.length === 0 ||
        review.product?.toLowerCase().includes(normalized) ||
        review.customer?.toLowerCase().includes(normalized) ||
        review.comment?.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || review.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [reviews, query, statusFilter]);

  const handleReviewAction = async (reviewId: number, action: "approve" | "reject") => {
    if (isParentContext) return;
    try {
      const updated = await fetchAdmin(`/reviews/${reviewId}/${action}`, { method: "PATCH" });
      setReviews((current) => current.map((review) => (review.id === reviewId ? updated : review)));
      toast.success(`Review ${action}d`, { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update review", { className: "luxury-toast" });
    }
  };

  const handleDelete = async (reviewId: number) => {
    if (isParentContext) return;
    if (!window.confirm("Delete this review?")) return;
    try {
      await fetchAdmin(`/reviews/${reviewId}`, { method: "DELETE" });
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      toast.success("Review deleted", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete review", { className: "luxury-toast" });
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Review workflow</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Reviews</h2>
            {isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#A16207]">Parent context • Read only</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="sr-only">Search reviews</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by product, customer or text"
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              />
            </label>
            <label className="block">
              <span className="sr-only">Review status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
              >
                <option value="all">All reviews</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState title="No reviews found" description="Approve or reject reviews once they appear in the moderation queue." />
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
          <div className="space-y-4">
            {filtered.map((review) => (
              <div key={review.id} className="rounded-[20px] border border-slate-200 bg-[#F8FAFC] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-[#D4AF37]">{review.product || "Product review"}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#041E42]">{review.customer || "Anonymous customer"}</h3>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusPill(review.status)}`}>
                      {review.status || "Pending"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-[#041E42]">{review.rating ?? "-"}?</span>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#4B5563]">{review.comment || "No review text provided."}</p>
                {!isParentContext && <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleReviewAction(review.id, "approve")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewAction(review.id, "reject")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-[#041E42] hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(review.id)}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SettingsPage() {
  const { isParentContext } = useAdminContext();
  const [settings, setSettings] = useState<SettingsRecord | null>(null);
  const [form, setForm] = useState({ storeName: "", supportEmail: "", currency: "INR", taxRate: "0.18", freeShippingThreshold: "999", maintenanceMode: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAdmin("/settings");
        setSettings(data);
        setForm({
          storeName: data.storeName || "",
          supportEmail: data.supportEmail || "",
          currency: data.currency || "INR",
          taxRate: data.taxRate != null ? String(data.taxRate) : "0.18",
          freeShippingThreshold: data.freeShippingThreshold != null ? String(data.freeShippingThreshold) : "999",
          maintenanceMode: Boolean(data.maintenanceMode),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    if (isParentContext) return;
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        storeName: form.storeName,
        supportEmail: form.supportEmail,
        currency: form.currency,
        taxRate: Number(form.taxRate),
        freeShippingThreshold: Number(form.freeShippingThreshold),
        maintenanceMode: form.maintenanceMode,
      };
      const updated = await fetchAdmin("/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSettings(updated);
      toast.success("Settings saved", { className: "luxury-toast" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save settings", { className: "luxury-toast" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Store configuration</p>
          <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Settings</h2>
          {isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#A16207]">Parent context • Read only</p>}
        </div>
      </div>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Store name</span>
          <input
            value={form.storeName}
            onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))}
            disabled={isParentContext}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Support email</span>
          <input
            type="email"
            value={form.supportEmail}
            onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))}
            disabled={isParentContext}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Currency</span>
          <input
            value={form.currency}
            onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
            disabled={isParentContext}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Tax rate</span>
          <input
            type="number"
            step="0.01"
            value={form.taxRate}
            onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))}
            disabled={isParentContext}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block font-semibold text-[#041E42]">Free shipping threshold</span>
          <input
            type="number"
            value={form.freeShippingThreshold}
            onChange={(event) => setForm((current) => ({ ...current, freeShippingThreshold: event.target.value }))}
            disabled={isParentContext}
            className="w-full rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20"
          />
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-600 md:col-span-2">
          <input
            type="checkbox"
            checked={form.maintenanceMode}
            onChange={(event) => setForm((current) => ({ ...current, maintenanceMode: event.target.checked }))}
            disabled={isParentContext}
            className="h-4 w-4 rounded border-slate-300 text-[#041E42] focus:ring-[#D4AF37]"
          />
          <span className="font-semibold text-[#041E42]">Maintenance mode</span>
        </label>
        {!isParentContext && <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-full bg-[#041E42] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#072e63] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          <p className="text-sm text-[#4B5563]">Store settings are updated instantly for administrative staff.</p>
        </div>}
        {isParentContext && <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold text-[#A16207]">Parent context • Read only</span>
          <p className="text-sm text-[#4B5563]">Read-only configuration visibility. No settings mutation is available.</p>
        </div>}
      </form>
    </section>
  );
}

function OrderDetailsPage() {
  const { orderId } = useParams();
  const { isParentContext } = useAdminContext();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("PENDING");

  const loadOrder = async () => {
    try {
      setLoading(true);
      if (!orderId) throw new Error('Missing order id');
      const data = await fetchAdmin(`/orders/${orderId}`);
      setOrder(data || null);
      setNextStatus(String(data?.status || 'PENDING'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const handleStatusUpdate = async () => {
    if (isParentContext || !order || !orderId) return;
    try {
      setUpdatingStatus(true);
      await fetchAdmin(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note: `Status changed by admin route ${order.user?.name || 'system'}` }),
      });
      await loadOrder();
      toast.success('Order status updated', { className: 'luxury-toast' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update order status', { className: 'luxury-toast' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) return <LoadingShell />;
  if (error) return <ErrorState message={error} />;
  if (!order) return <EmptyState title="Order not found" description="The order may have been removed." />;

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Order detail</p>
            <h2 className="mt-2 text-xl font-semibold text-[#041E42]">Order #{order.id}</h2>
            {isParentContext && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#A16207]">Parent context • Read only</p>}
          </div>
          {!isParentContext && <div className="flex items-center gap-3">
            <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-[#111111] outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20">
              {VALID_ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <button type="button" onClick={handleStatusUpdate} disabled={updatingStatus} className="rounded-full border border-[#D4AF37] bg-[#FFF8E8] px-4 py-2 text-xs font-semibold text-[#041E42] hover:bg-[#F8E6A7] disabled:opacity-70">
              {updatingStatus ? 'Updating...' : 'Update status'}
            </button>
          </div>}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-[#041E42]">Store</p>
            <p className="mt-1 text-sm text-[#4B5563]">{order.store?.name || order.store?.slug || 'Store'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#041E42]">Customer</p>
            <p className="mt-1 text-sm text-[#4B5563]">{order.user?.name || order.user?.email || 'Guest'}</p>
            <p className="text-sm text-[#4B5563]">{order.user?.email || 'No email'}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#041E42]">Ordered</p>
            <p className="mt-1 text-sm text-[#4B5563]">{formatDate(order.createdAt)}</p>
            <p className="text-sm text-[#4B5563]">{formatCurrency(order.totalPrice)}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-[#041E42]">Current status</p>
            <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(order.status)}`}>{order.status || 'Unknown'}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#041E42]">Order total</p>
            <p className="mt-1 text-sm font-semibold text-[#041E42]">{formatCurrency(order.totalPrice)}</p>
          </div>
        </div>
        <div className="mt-6">
          <p className="text-sm font-semibold text-[#041E42]">Items</p>
          <div className="mt-3 space-y-3">
            {order.items?.map((item, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#041E42]">{item.product?.name || 'Unknown product'}</p>
                    <p className="text-sm text-[#4B5563]">Variant: {item.variant?.name || item.variant?.sku || item.variant?.id || 'Standard variant'}</p>
                    <p className="text-sm text-[#4B5563]">Qty: {item.quantity ?? 1}</p>
                    {item.variant?.size && <p className="text-sm text-[#4B5563]">Size: {item.variant.size}</p>}
                    {item.variant?.color && <p className="text-sm text-[#4B5563]">Color: {item.variant.color}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#041E42]">{formatCurrency(item.price)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8">
          <p className="text-sm font-semibold text-[#041E42]">Status history</p>
          <div className="mt-3 space-y-3">
            {(order.statusHistory || []).map((history, index) => (
              <div key={history.id ?? index} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(history.status)}`}>{history.status || 'Unknown'}</span>
                    <p className="mt-2 text-sm text-[#4B5563]">{history.note || 'Status transition update'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#4B5563]">{formatDate(history.createdAt)}</p>
                    <p className="text-sm text-[#4B5563]">{history.changedBy?.name || history.changedBy?.email || 'System / Admin'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminRoutePage;
