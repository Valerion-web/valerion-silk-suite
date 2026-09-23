import React, { Component, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  RefreshCw,
  Bell,
  Download,
  FilePlus,
  Layers,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Warehouse,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { adminApiFetch } from "@/lib/admin-api";
import { useAdminContext } from "@/lib/admin-context";
import InventoryTable from "./InventoryTable";
import type { InventoryItem, SortKey } from "./types";

const baseColors = {
  surface: "#FFFFFF",
  border: "#E7EBF3",
  background: "#F8FAFC",
  text: "#0A1931",
  muted: "#64748B",
  gold: "#D4AF37",
  green: "#22C55E",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

const cardShellClass = "flex h-[420px] flex-col overflow-hidden rounded-[20px] border border-[#E7EBF3] bg-white p-7 shadow-[0_18px_45px_-26px_rgba(4,30,66,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_rgba(4,30,66,0.2)]";

const warehouseOptions = ["Main Warehouse", "Flagship Boutique", "Regional Hub", "Outlet Warehouse"];
const categoryOptions = ["Tuxedos", "Silk Shirts", "Luxury Blazers", "Formalwear", "Premium Shirts", "Accessories", "Tailored Suits"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });

const formatHeaderDate = () =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date());

type AdminInventoryResponseItem = {
  id: number;
  name: string;
  sku: string;
  countInStock: number;
  reservedStock: number;
  stockStatus: InventoryItem["status"];
  lastUpdated: string;
  image?: string | null;
  category?: { id?: number; name?: string } | null;
};

type AdminLowStockResponseItem = {
  productId: number;
};

async function fetchAdminInventory<T>(path: string): Promise<T> {
  const response = await adminApiFetch(`/api/admin${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || "Unable to load inventory");
  return body as T;
}

const mapAdminInventory = (items: AdminInventoryResponseItem[], lowStockItems: AdminLowStockResponseItem[]): InventoryItem[] => {
  const lowStockProductIds = new Set(lowStockItems.map((item) => item.productId));
  return items.map((item) => ({
    id: item.id,
    productId: String(item.id),
    name: item.name,
    sku: item.sku,
    category: item.category?.name ?? "Uncategorized",
    warehouse: "Main Warehouse",
    currentStock: Number(item.countInStock || 0),
    reservedStock: Number(item.reservedStock || 0),
    reorderLevel: 10,
    unitCost: 0,
    price: 0,
    image: item.image || undefined,
    status: item.stockStatus === "OUT_OF_STOCK" ? item.stockStatus : lowStockProductIds.has(item.id) ? "LOW_STOCK" : item.stockStatus,
    lastUpdated: item.lastUpdated,
    history: [],
  }));
};

const defaultValueTrend = [
  { month: "Jan", value: 1260000 },
  { month: "Feb", value: 1320000 },
  { month: "Mar", value: 1385000 },
  { month: "Apr", value: 1440000 },
  { month: "May", value: 1495000 },
  { month: "Jun", value: 1530000 },
  { month: "Jul", value: 1585000 },
];

const defaultLowStockTrend = [
  { month: "Jan", value: 18 },
  { month: "Feb", value: 16 },
  { month: "Mar", value: 19 },
  { month: "Apr", value: 21 },
  { month: "May", value: 20 },
  { month: "Jun", value: 24 },
  { month: "Jul", value: 22 },
];

const defaultMovement = [
  { month: "Jan", added: 36, sold: 28, returned: 4, adjusted: 2 },
  { month: "Feb", added: 42, sold: 29, returned: 5, adjusted: 3 },
  { month: "Mar", added: 46, sold: 34, returned: 6, adjusted: 2 },
  { month: "Apr", added: 51, sold: 37, returned: 6, adjusted: 4 },
  { month: "May", added: 48, sold: 39, returned: 7, adjusted: 3 },
  { month: "Jun", added: 55, sold: 41, returned: 6, adjusted: 4 },
  { month: "Jul", added: 58, sold: 43, returned: 5, adjusted: 3 },
];

const defaultCategoryData = [
  { name: "Shirts", value: 24, color: baseColors.gold },
  { name: "Blazers", value: 18, color: baseColors.text },
  { name: "Trousers", value: 14, color: baseColors.blue },
  { name: "Suits", value: 10, color: baseColors.green },
  { name: "Accessories", value: 8, color: baseColors.orange },
  { name: "Others", value: 6, color: baseColors.red },
];

const getStatusMetadata = (status: InventoryItem["status"]) => {
  if (status === "OUT_OF_STOCK") return { label: "Out of stock", bg: "#FEE2E2", text: baseColors.red };
  if (status === "LOW_STOCK") return { label: "Low stock", bg: "#FEF3C7", text: baseColors.orange };
  return { label: "In stock", bg: "#ECFDF5", text: baseColors.green };
};

class InventoryErrorBoundary extends Component<{ title: string; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`Inventory widget error: ${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[18px] border border-[#F1F5F9] bg-white p-6 text-center shadow-[0_14px_30px_-20px_rgba(9,30,66,0.18)]">
          <p className="text-sm font-semibold text-[#0F172A]">Unable to load this widget.</p>
          <p className="mt-2 text-xs text-[#475569]">{this.props.title} failed to render.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function InventoryHeader({ value, onSearch, pageSearch, isParentContext }: { value: string; onSearch: (value: string) => void; pageSearch: string; isParentContext: boolean }) {
  return (
    <div className="rounded-[18px] border border-[#E7EBF3] bg-white p-6 shadow-[0_16px_40px_-24px_rgba(9,30,66,0.16)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.28em] text-[#94A3B8]">Inventory management</p>
          <div>
            <h1 className="text-3xl font-semibold text-[#0A1931]">Inventory dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">{isParentContext ? "Parent context • Read only. Inspect inventory across active child-store inventory scope." : "Track stock across the catalog, adjust inventory levels, and keep low-stock items under control."}</p>
          </div>
        </div>
        <div className="grid w-full gap-4 sm:grid-cols-[1fr_auto] xl:w-auto xl:grid-cols-[minmax(260px,420px)_auto]">
          <label className="relative block w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={pageSearch}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search inventory, SKU, category or warehouse"
              className="w-full rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] py-4 pl-12 pr-4 text-sm text-[#0A1931] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </label>
          <div className="inline-flex items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-4 text-sm font-semibold text-[#0A1931] shadow-sm">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, delta, color, sparkline, icon }: { title: string; value: string; delta: string; color: string; sparkline: number[]; icon: ReactNode }) {
  const points = sparkline.map((value, index) => `${(index / (sparkline.length - 1 || 1)) * 100},${60 - (value / 40) * 50}`).join(" ");
  return (
    <div className="h-[148px] rounded-[16px] border border-[#E7EBF3] bg-white p-4 shadow-[0_12px_30px_-24px_rgba(9,30,66,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#94A3B8]">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-[#0A1931]">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F8FAFC] text-[#0A1931] shadow-sm">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#475569]">
        <span className="font-semibold" style={{ color }}>{delta}</span>
        <span className="text-xs">vs last month</span>
      </div>
      <div className="mt-4 h-12 overflow-hidden rounded-[14px] bg-[#F8FAFC] px-2 py-2">
        <svg viewBox="0 0 100 60" className="h-full w-full overflow-visible">
          <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" points={points} />
        </svg>
      </div>
    </div>
  );
}

function ScoreBadge({ label, color }: { label: string; color: string }) {
  return <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]" style={{ color, borderColor: color }}>{label}</span>;
}

function DistributionCard({ data }: { data: Array<{ name: string; value: number; color: string; percent: number }> }) {
  return (
    <div className="h-full rounded-[18px] border border-[#E7EBF3] bg-white p-5 shadow-[0_14px_30px_-20px_rgba(9,30,66,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#94A3B8]">Inventory Distribution</p>
          <h2 className="mt-3 text-xl font-semibold text-[#0A1931]">Stock health split</h2>
        </div>
        <ScoreBadge label="Healthy" color={baseColors.green} />
      </div>
      <div className="mt-5 grid h-[336px] gap-4 lg:grid-cols-[0.9fr_0.9fr] lg:items-center">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={80} outerRadius={110} paddingAngle={6} stroke="transparent">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} units`, "Units"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex h-full flex-col justify-center gap-3 rounded-[18px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-[14px] bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                <div>
                  <p className="text-sm font-semibold text-[#0A1931]">{item.name}</p>
                  <p className="text-xs text-[#64748B]">{item.value} units</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#0A1931]">{item.percent}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ValueTrendCard({ data, range, onRangeChange }: { data: Array<{ month: string; value: number }>; range: string; onRangeChange: (range: "monthly" | "quarterly" | "yearly") => void }) {
  return (
    <div className={`${cardShellClass} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.32em] text-[#64748B]">Inventory value</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#0A1931]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Inventory Value Trend
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-[#64748B]">A premium view of valuation growth across the season.</p>
        </div>
        <div className="inline-flex rounded-full border border-[#E7EBF3] bg-[#F8FAFC] p-1 text-sm text-[#0A1931]">
          {(["monthly", "quarterly", "yearly"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onRangeChange(option)}
              className={`rounded-full px-4 py-2 transition ${range === option ? "bg-[#0A1931] text-white" : "text-[#475569] hover:bg-white"}`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex-1">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="valueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={baseColors.gold} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={baseColors.gold} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 100000)}K`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrency(value)} />
              <Area type="monotone" dataKey="value" stroke={baseColors.gold} strokeWidth={3} fill="url(#valueTrendGradient)" activeDot={{ r: 6, fill: baseColors.gold, stroke: baseColors.text, strokeWidth: 2 }} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function WarehouseAllocationCard({ items }: { items: Array<{ name: string; available: number; reserved: number; percent: number; color: string }> }) {
  return (
    <div className={`${cardShellClass} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.32em] text-[#64748B]">Warehouse allocation</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#0A1931]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Warehouse Allocation
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-[#64748B]">Capacity is balanced across the network with premium visibility.</p>
        </div>
        <ScoreBadge label="Live" color={baseColors.blue} />
      </div>

      <div className="mt-6 flex-1 space-y-3">
        {items.map((item) => (
          <div key={item.name} className="rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0A1931]">{item.name}</p>
                <p className="text-xs text-[#64748B]">{item.percent}% of inventory</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#0A1931]">{item.available + item.reserved}</p>
                <p className="text-xs text-[#64748B]">Capacity units</p>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-[#E2E8F0]">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${item.percent}%`, backgroundColor: item.color }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[12px] bg-white px-3 py-2 text-sm shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#64748B]">Avail</p>
                <p className="mt-1 font-semibold text-[#0A1931]">{item.available}</p>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2 text-sm shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#64748B]">Res</p>
                <p className="mt-1 font-semibold text-[#0A1931]">{item.reserved}</p>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2 text-sm shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#64748B]">Cap</p>
                <p className="mt-1 font-semibold text-[#0A1931]">{item.percent}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovementCard({ data }: { data: Array<{ month: string; added: number; sold: number; returned: number; adjusted: number }> }) {
  return (
    <div className={`${cardShellClass} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.32em] text-[#64748B]">Inventory movement</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#0A1931]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Stock Movement
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-[#64748B]">A refined view of inbound, outbound, and adjustment activity.</p>
        </div>
        <ScoreBadge label="Stacked" color={baseColors.gold} />
      </div>

      <div className="mt-6 flex-1">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} units`, name]} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: 8, fontSize: 12, color: baseColors.muted }} />
              <Bar dataKey="added" stackId="a" fill={baseColors.green} radius={[10, 10, 0, 0]} />
              <Bar dataKey="sold" stackId="a" fill={baseColors.text} radius={[10, 10, 0, 0]} />
              <Bar dataKey="returned" stackId="a" fill={baseColors.gold} radius={[10, 10, 0, 0]} />
              <Bar dataKey="adjusted" stackId="a" fill={baseColors.blue} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function LowStockCard({ data }: { data: Array<{ month: string; value: number }> }) {
  return (
    <div className={`${cardShellClass} flex flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.32em] text-[#64748B]">Low stock alert</p>
          <h2 className="mt-2 text-[30px] font-semibold leading-tight text-[#0A1931]" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
            Inventory Alerts
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-[#64748B]">Trigger points stay visible before replenishment becomes urgent.</p>
        </div>
        <ScoreBadge label="Alert" color={baseColors.red} />
      </div>

      <div className="mt-6 flex-1">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: baseColors.muted, fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} units`, "Low Stock"]} />
              <Line type="monotone" dataKey="value" stroke={baseColors.red} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: baseColors.red, stroke: baseColors.text, strokeWidth: 2 }} strokeLinecap="round" animationDuration={900} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <div className="h-full rounded-[18px] border border-[#E7EBF3] bg-white p-5 shadow-[0_14px_30px_-20px_rgba(9,30,66,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#94A3B8]">Inventory by Category</p>
          <h2 className="mt-3 text-xl font-semibold text-[#0A1931]">Inventory category</h2>
        </div>
        <ScoreBadge label="Overview" color={baseColors.blue} />
      </div>
      <div className="mt-5 grid h-[336px] gap-4 lg:grid-cols-[0.9fr_0.9fr] lg:items-center">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={70} outerRadius={104} paddingAngle={6} stroke="transparent">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} items`, "Category"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {data.map((segment) => (
            <div key={segment.name} className="flex items-center justify-between gap-3 rounded-[14px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <div>
                  <p className="text-sm font-semibold text-[#0A1931]">{segment.name}</p>
                  <p className="text-xs text-[#64748B]">{segment.value} items</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#0A1931]">{Math.round((segment.value / total) * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: baseColors.text,
  border: `1px solid ${baseColors.gold}`,
  borderRadius: 14,
  color: baseColors.surface,
  fontSize: 12,
};

export default function InventoryDashboard() {
  const { isParentContext } = useAdminContext();
  const [inventory, setInventory] = useState<InventoryItem[]>(() => []);
  const [pageSearch, setPageSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [chartRange, setChartRange] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminInventory<AdminInventoryResponseItem[]>("/inventory").then((response) => response || []),
      fetchAdminInventory<AdminLowStockResponseItem[]>("/inventory/low-stock").catch(() => []),
    ])
      .then(([items, lowStockItems]) => {
        if (!cancelled) {
          setInventory(mapAdminInventory(items, lowStockItems));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInventory([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isParentContext) {
      setMenuOpenId(null);
    }
  }, [isParentContext]);

  useEffect(() => setPage(1), [tableSearch, warehouseFilter, categoryFilter, statusFilter, pageSize]);

  const filteredInventory = useMemo(() => {
    const normalized = tableSearch.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchesQuery =
        normalized.length === 0 ||
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        item.warehouse.toLowerCase().includes(normalized);
      const matchesWarehouse = warehouseFilter === "all" || item.warehouse === warehouseFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "inStock" && item.status === "IN_STOCK") ||
        (statusFilter === "lowStock" && item.status === "LOW_STOCK") ||
        (statusFilter === "outOfStock" && item.status === "OUT_OF_STOCK");
      return matchesQuery && matchesWarehouse && matchesCategory && matchesStatus;
    });
  }, [inventory, tableSearch, warehouseFilter, categoryFilter, statusFilter]);

  const sortedInventory = useMemo(() => {
    const items = [...filteredInventory];
    items.sort((left, right) => {
      if (sortKey === "name") return sortDirection === "asc" ? left.name.localeCompare(right.name) : right.name.localeCompare(left.name);
      if (sortKey === "sku") return sortDirection === "asc" ? left.sku.localeCompare(right.sku) : right.sku.localeCompare(left.sku);
      if (sortKey === "warehouse") return sortDirection === "asc" ? left.warehouse.localeCompare(right.warehouse) : right.warehouse.localeCompare(left.warehouse);
      if (sortKey === "currentStock") return sortDirection === "asc" ? left.currentStock - right.currentStock : right.currentStock - left.currentStock;
      if (sortKey === "reservedStock") return sortDirection === "asc" ? left.reservedStock - right.reservedStock : right.reservedStock - left.reservedStock;
      if (sortKey === "available") {
        const leftAvailable = left.currentStock - left.reservedStock;
        const rightAvailable = right.currentStock - right.reservedStock;
        return sortDirection === "asc" ? leftAvailable - rightAvailable : rightAvailable - leftAvailable;
      }
      if (sortKey === "status") return sortDirection === "asc" ? left.status.localeCompare(right.status) : right.status.localeCompare(left.status);
      if (sortKey === "lastUpdated") return sortDirection === "asc" ? new Date(left.lastUpdated).getTime() - new Date(right.lastUpdated).getTime() : new Date(right.lastUpdated).getTime() - new Date(left.lastUpdated).getTime();
      return 0;
    });
    return items;
  }, [filteredInventory, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedInventory.length / pageSize));
  const paginatedInventory = useMemo(() => sortedInventory.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize), [sortedInventory, page, pageSize]);

  const stats = useMemo(() => {
    const totalUnits = inventory.reduce((sum, item) => sum + item.currentStock, 0);
    const inventoryValue = inventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
    const inStock = inventory.filter((item) => item.status === "IN_STOCK").length;
    const lowStock = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStock = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;
    return { totalSkus: inventory.length, totalUnits, inventoryValue, inStock, lowStock, outOfStock };
  }, [inventory]);

  const cardStats = useMemo(
    () => [
      { title: "Total Products", value: stats.totalSkus.toString(), delta: "+4.8%", color: baseColors.blue, sparkline: [12, 14, 13, 16, 18, 17], icon: <Sparkles className="h-5 w-5" /> },
      { title: "Total Units", value: stats.totalUnits.toString(), delta: "+3.2%", color: baseColors.green, sparkline: [14, 16, 15, 18, 20, 19], icon: <Layers className="h-5 w-5" /> },
      { title: "Inventory Value", value: formatCurrency(stats.inventoryValue), delta: "+8.9%", color: baseColors.gold, sparkline: [18, 24, 22, 30, 29, 36], icon: <PieIcon className="h-5 w-5" /> },
      { title: "In Stock", value: stats.inStock.toString(), delta: "+2.1%", color: baseColors.green, sparkline: [11, 13, 15, 17, 16, 18], icon: <ShieldCheck className="h-5 w-5" /> },
      { title: "Low Stock", value: stats.lowStock.toString(), delta: "-1.7%", color: baseColors.orange, sparkline: [12, 10, 9, 8, 7, 6], icon: <LineIcon className="h-5 w-5" /> },
      { title: "Out of Stock", value: stats.outOfStock.toString(), delta: "-0.8%", color: baseColors.red, sparkline: [8, 7, 6, 5, 4, 3], icon: <FilePlus className="h-5 w-5" /> },
    ],
    [stats]
  );

  const distributionData = useMemo(() => {
    const inStockUnits = inventory.reduce((sum, item) => sum + (item.status === "IN_STOCK" ? item.currentStock : 0), 0);
    const reservedUnits = inventory.reduce((sum, item) => sum + item.reservedStock, 0);
    const lowStockUnits = inventory.reduce((sum, item) => sum + (item.status === "LOW_STOCK" ? item.currentStock : 0), 0);
    const outOfStockUnits = inventory.reduce((sum, item) => sum + (item.status === "OUT_OF_STOCK" ? item.currentStock : 0), 0);
    const total = Math.max(1, inStockUnits + reservedUnits + lowStockUnits + outOfStockUnits);
    return [
      { name: "In Stock", value: inStockUnits, color: baseColors.green, percent: Number(((inStockUnits / total) * 100).toFixed(0)) },
      { name: "Reserved", value: reservedUnits, color: baseColors.blue, percent: Number(((reservedUnits / total) * 100).toFixed(0)) },
      { name: "Low Stock", value: lowStockUnits, color: baseColors.orange, percent: Number(((lowStockUnits / total) * 100).toFixed(0)) },
      { name: "Out of Stock", value: outOfStockUnits, color: baseColors.red, percent: Number(((outOfStockUnits / total) * 100).toFixed(0)) },
    ];
  }, [inventory]);

  const warehouseAllocation = useMemo(() => {
    const base = Math.max(1, stats.totalUnits);
    const data = [
      { name: "Main Warehouse", available: Math.round(base * 0.36), reserved: Math.round(base * 0.08), percent: 36, color: baseColors.blue },
      { name: "Flagship Boutique", available: Math.round(base * 0.22), reserved: Math.round(base * 0.04), percent: 22, color: baseColors.gold },
      { name: "Regional Hub", available: Math.round(base * 0.18), reserved: Math.round(base * 0.03), percent: 18, color: baseColors.green },
      { name: "Outlet Warehouse", available: Math.round(base * 0.14), reserved: Math.round(base * 0.03), percent: 14, color: baseColors.orange },
    ];
    return data;
  }, [stats.totalUnits]);

  const valueTrend = useMemo(() => defaultValueTrend, []);
  const lowStockTrend = useMemo(() => defaultLowStockTrend, []);
  const inventoryMovement = useMemo(() => defaultMovement, []);
  const categoryData = useMemo(() => defaultCategoryData, []);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px] space-y-6">
          <div className="h-32 rounded-[18px] bg-[#E7EBF3]" />
          <div className="grid gap-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[148px] rounded-[18px] bg-[#E7EBF3]" />
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[392px] rounded-[18px] bg-[#E7EBF3]" />
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[392px] rounded-[18px] bg-[#E7EBF3]" />
            ))}
          </div>
          <div className="h-[620px] rounded-[18px] bg-[#E7EBF3]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <InventoryHeader value={formatHeaderDate()} onSearch={setPageSearch} pageSearch={pageSearch} isParentContext={isParentContext} />

        <section className="grid gap-5 xl:grid-cols-6">
          {cardStats.map((card) => (
            <KpiCard key={card.title} title={card.title} value={card.value} delta={card.delta} color={card.color} sparkline={card.sparkline} icon={card.icon} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <InventoryErrorBoundary title="Inventory distribution">
              <DistributionCard data={distributionData} />
            </InventoryErrorBoundary>
          </div>
          <div className="xl:col-span-4">
            <InventoryErrorBoundary title="Inventory value trend">
              <ValueTrendCard data={valueTrend} range={chartRange} onRangeChange={setChartRange} />
            </InventoryErrorBoundary>
          </div>
          <div className="xl:col-span-4">
            <InventoryErrorBoundary title="Warehouse allocation">
              <WarehouseAllocationCard items={warehouseAllocation} />
            </InventoryErrorBoundary>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <InventoryErrorBoundary title="Inventory movement">
            <MovementCard data={inventoryMovement} />
          </InventoryErrorBoundary>
          <InventoryErrorBoundary title="Low stock trend">
            <LowStockCard data={lowStockTrend} />
          </InventoryErrorBoundary>
        </section>

        <InventoryErrorBoundary title="Inventory table">
          <div className="rounded-[18px] border border-[#E7EBF3] bg-white p-5 shadow-[0_14px_30px_-20px_rgba(9,30,66,0.18)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#94A3B8]">Inventory roster</p>
                <h2 className="mt-3 text-2xl font-semibold text-[#0A1931]">Inventory table</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {!isParentContext && <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#0A1931] transition hover:border-[#2563EB]">Bulk Actions</button>}
                {!isParentContext && <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition hover:border-[#2563EB]">Export Selected</button>}
                {!isParentContext && <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#FEE2E2] bg-[#FEF2F2] px-4 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2]">Delete Selected</button>}
              </div>
            </div>
            <div className="mt-6">
              <InventoryTable
                items={paginatedInventory}
                visibleCount={sortedInventory.length}
                query={tableSearch}
                onQueryChange={setTableSearch}
                warehouseFilter={warehouseFilter}
                onWarehouseFilterChange={setWarehouseFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                sortKey={sortKey}
                sortDirection={sortDirection}
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                onSort={onSort}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onClearFilters={() => {
                  setTableSearch("");
                  setWarehouseFilter("all");
                  setCategoryFilter("all");
                  setStatusFilter("all");
                }}
                menuOpenId={menuOpenId}
                onMenuToggle={setMenuOpenId}
                warehouseOptions={warehouseOptions}
                categoryOptions={categoryOptions}
                readOnly={isParentContext}
              />
            </div>
          </div>
        </InventoryErrorBoundary>
      </div>
    </div>
  );
}
