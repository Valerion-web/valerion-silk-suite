import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { adminApiFetch } from "@/lib/admin-api";
import { useAdminContext } from "@/lib/admin-context";
import {
  Search,
  Grid,
  List,
  Plus,
  Upload,
  Download,
  ChevronDown,
  Filter,
  Heart,
  Edit,
  Copy,
  Eye,
  Trash2,
  Archive,
  Package,
  CheckCircle2,
  Sparkles,
  Tag,
  TrendingUp,
  FileText,
  Star,
  BarChart3,
  ArrowUpRight,
  Globe2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ProductRecord = {
  id: number;
  name?: string;
  sku?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  category?: { id?: number; name?: string } | null;
  brand?: { id?: number; name?: string } | null;
  collection?: string;
  tags?: string[];
  images?: string[];
  price?: number | string;
  originalPrice?: number | string;
  discountPercent?: number | string;
  taxPercent?: number | string;
  countInStock?: number;
  lowStockThreshold?: number;
  stockStatus?: string;
  featured?: boolean;
  status?: string;
  variants?: Array<{ size?: string; color?: string; material?: string; stock?: number | string; price?: number | string }>;
  metaTitle?: string;
  metaDescription?: string;
  urlSlug?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ProductVariant = {
  id: string;
  size: string;
  color: string;
  material: string;
  stock: string;
  price: string;
};

type BrandRecord = {
  id: number;
  name: string;
  slug: string;
  description: string;
  story: string;
  country: string;
  founder: string;
  established: string;
  products: number;
  collections: number;
  revenue: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  featured: boolean;
  color: string;
  website: string;
  logoUrl?: string;
  coverUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt?: string;
  tagLine?: string;
};

type BrandFormState = {
  name: string;
  slug: string;
  description: string;
  story: string;
  country: string;
  founder: string;
  established: string;
  website: string;
  color: string;
  status: BrandRecord["status"];
  featured: boolean;
  collections: string;
  seoTitle: string;
  seoDescription: string;
  logoUrl: string;
  coverUrl: string;
  tagLine: string;
};

type ImageItem = {
  id: string;
  url: string;
  file?: File;
  featured?: boolean;
};

type ProductFormValues = {
  name: string;
  sku: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  originalPrice: string;
  discountPercent: string;
  taxPercent: string;
  countInStock: string;
  lowStockThreshold: string;
  stockStatus: string;
  categoryId: number | "";
  brandId: number | "";
  collection: string;
  tags: string;
  images: ImageItem[];
  variants: ProductVariant[];
  featured: boolean;
  status: string;
  metaTitle: string;
  metaDescription: string;
  urlSlug: string;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_FORM: ProductFormValues = {
  name: "",
  sku: "",
  slug: "",
  shortDescription: "",
  description: "",
  price: "",
  originalPrice: "",
  discountPercent: "",
  taxPercent: "",
  countInStock: "",
  lowStockThreshold: "",
  stockStatus: "IN_STOCK",
  categoryId: "",
  brandId: "",
  collection: "",
  tags: "",
  images: [],
  variants: [
    { id: "variant-1", size: "", color: "", material: "", stock: "", price: "" },
  ],
  featured: false,
  status: "DRAFT",
  metaTitle: "",
  metaDescription: "",
  urlSlug: "",
};

function createImageItem(url: string, file?: File, featured = false): ImageItem {
  return { id: `${Date.now()}-${Math.random()}`, url, file, featured };
}

function parseNumber(value: string | number | undefined) {
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function getStockStatusLabel(status: string) {
  if (status === "LOW_STOCK") return "Low stock";
  if (status === "OUT_OF_STOCK") return "Out of stock";
  return "In stock";
}

function getStockStatusPill(status: string) {
  if (status === "LOW_STOCK") return "bg-amber-100 text-amber-700";
  if (status === "OUT_OF_STOCK") return "bg-rose-100 text-rose-700";
  return "bg-emerald-100 text-emerald-700";
}

function formatDateLabel(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function deriveInventoryStatus(count: number, lowThreshold: number) {
  if (count <= 0) return "OUT_OF_STOCK";
  if (count <= lowThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function formatCurrency(value: number | string | undefined) {
  const numeric = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numeric);
}

function fetchAdmin(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") headers.set("Content-Type", "application/json");
  return adminApiFetch(`/api/admin${path}`, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Admin request failed");
    return data;
  });
}

async function uploadProductImages(files: File[]) {
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await fetchAdmin("/product-images", { method: "POST", body });
  if (!Array.isArray(response?.images) || response.images.some((url: unknown) => typeof url !== "string" || url.startsWith("blob:"))) {
    throw new Error("Image upload did not return persistent image paths.");
  }
  return response.images as string[];
}

function normalizeBrandPayload(payload: unknown): BrandRecord[] | null {
  if (Array.isArray(payload)) {
    return payload as BrandRecord[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.brands)) return record.brands as BrandRecord[];
    if (Array.isArray(record.data)) return record.data as BrandRecord[];
    if (Array.isArray(record.items)) return record.items as BrandRecord[];
  }

  return null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-8 text-sm text-[#111827] shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)]">
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">Error</span>
        <span className="font-semibold text-[#111827]">Unable to load product data</span>
      </div>
      <p className="mt-3 text-[#475569]">{message}</p>
    </div>
  );
}

const KPI_CARDS = [
  { label: "Total Products", icon: Package, key: "total", trend: "+8.2%", sparkline: [12, 14, 17, 18, 21, 24, 28], color: "#0A1931" },
  { label: "Published", icon: CheckCircle2, key: "published", trend: "+5.4%", sparkline: [18, 19, 21, 22, 24, 26, 29], color: "#2563EB" },
  { label: "Draft", icon: Sparkles, key: "drafts", trend: "-1.2%", sparkline: [8, 7, 8, 9, 9, 8, 7], color: "#D4AF37" },
  { label: "Out Of Stock", icon: Tag, key: "lowStock", trend: "-3.8%", sparkline: [6, 7, 7, 6, 5, 5, 4], color: "#EF4444" },
  { label: "Categories", icon: TrendingUp, key: "categories", trend: "+2.1%", sparkline: [4, 5, 5, 6, 6, 7, 8], color: "#22C55E" },
  { label: "Brands", icon: FileText, key: "brands", trend: "+1.4%", sparkline: [3, 4, 4, 4, 5, 5, 6], color: "#F59E0B" },
];

type ChartRange = "monthly" | "quarterly" | "yearly";

type ProductsTableProps = {
  products: ProductRecord[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  exportSelected: () => void;
  onDelete: (id: number) => void;
  onSetDrawerProduct: (product: ProductRecord | null) => void;
  pagination: { page: number; pageCount: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };
};

type ProductPerformanceSeries = { label: string; value: number }[];

type ProgressItem = { label: string; value: number; color: string; labelRight: string };

const widgetBase = "rounded-[16px] border border-[#E7EBF3] bg-white p-5 shadow-[0_16px_40px_-26px_rgba(15,23,42,0.08)]";

const chartTooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 14,
  color: "#111827",
  fontSize: 12,
  boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
};

const inputBase = "h-[44px] rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm text-[#0A1931] shadow-sm outline-none transition duration-200 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/15";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function statSparkline(points: number[]) {
  return points.map((point, index) => `${(index / (points.length - 1 || 1)) * 100},${68 - (point / Math.max(...points, 1)) * 52}`).join(" ");
}

function ProductsHeader({
  selectedCount,
  onCreate,
  onImport,
  onExport,
}: {
  selectedCount: number;
  onCreate: () => void;
  onImport: () => void;
  onExport: () => void;
}) {
  return (
    <div className="rounded-[16px] border border-[#E7EBF3] bg-white p-6 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.1)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.35em] text-[#64748B]">Catalogue</p>
          <h1 className="mt-3 text-[36px] font-semibold tracking-[-0.03em] text-[#0A1931]">Products</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#475569]">Manage your luxury catalogue, inventory, pricing, collections and product performance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onCreate} className="inline-flex h-[48px] items-center justify-center rounded-[14px] bg-[#0A1931] px-5 text-sm font-semibold text-white shadow-[0_18px_45px_-26px_rgba(10,25,49,0.48)] transition duration-200 hover:bg-[#08152c]">
            <Plus className="h-4 w-4" /> New Product
          </button>
          <button type="button" onClick={onImport} className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button type="button" onClick={onExport} className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
            <Download className="h-4 w-4" /> Export
          </button>
          <button type="button" className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
            Bulk Actions <ChevronDown className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>
      {selectedCount > 0 && (
        <div className="mt-6 rounded-[14px] bg-[#F8FAFC] p-4 text-sm text-[#0A1931]">
          {selectedCount} product{selectedCount > 1 ? "s" : ""} selected for bulk actions.
        </div>
      )}
    </div>
  );
}

function ProductsToolbar({
  query,
  onQueryChange,
  categoryFilter,
  brandFilter,
  collectionFilter,
  statusFilter,
  priceRange,
  priceBounds,
  sortBy,
  viewMode,
  categoryOptions,
  brandOptions,
  collectionOptions,
  onCategoryChange,
  onBrandChange,
  onCollectionChange,
  onStatusChange,
  onPriceRangeChange,
  onSortChange,
  onViewModeChange,
  onClear,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string;
  brandFilter: string;
  collectionFilter: string;
  statusFilter: string;
  priceRange: [number, number];
  priceBounds: [number, number];
  sortBy: string;
  viewMode: "grid" | "list";
  categoryOptions: string[];
  brandOptions: string[];
  collectionOptions: string[];
  onCategoryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onCollectionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onSortChange: (value: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  onClear: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[2.6fr_repeat(4,minmax(220px,1fr))_200px_240px]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3AF]" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search product"
          className={`${inputBase} pl-12`}
        />
      </div>

      <select value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)} className={inputBase}>
        <option value="">Category</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>{category}</option>
        ))}
      </select>

      <select value={brandFilter} onChange={(event) => onBrandChange(event.target.value)} className={inputBase}>
        <option value="">Brand</option>
        {brandOptions.map((brand) => (
          <option key={brand} value={brand}>{brand}</option>
        ))}
      </select>

      <select value={collectionFilter} onChange={(event) => onCollectionChange(event.target.value)} className={inputBase}>
        <option value="">Collection</option>
        {collectionOptions.map((collection) => (
          <option key={collection} value={collection}>{collection}</option>
        ))}
      </select>

      <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className={inputBase}>
        <option value="">Status</option>
        <option value="ACTIVE">Published</option>
        <option value="DRAFT">Draft</option>
        <option value="LOW_STOCK">Low Stock</option>
        <option value="OUT_OF_STOCK">Out Of Stock</option>
      </select>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          value={priceRange[0]}
          onChange={(event) => onPriceRangeChange([clamp(Number(event.target.value), priceBounds[0], priceRange[1]), priceRange[1]])}
          placeholder="Min price"
          className={inputBase}
        />
        <input
          type="number"
          value={priceRange[1]}
          onChange={(event) => onPriceRangeChange([priceRange[0], clamp(Number(event.target.value), priceRange[0], priceBounds[1])])}
          placeholder="Max price"
          className={inputBase}
        />
      </div>

      <select value={sortBy} onChange={(event) => onSortChange(event.target.value)} className={inputBase}>
        <option value="newest">Sort by</option>
        <option value="newest">Newest</option>
        <option value="priceAsc">Price: Low to High</option>
        <option value="priceDesc">Price: High to Low</option>
        <option value="stockAsc">Stock: Low to High</option>
        <option value="stockDesc">Stock: High to Low</option>
      </select>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-[16px] border ${viewMode === "grid" ? "border-[#D4AF37] bg-[#FEF8E8] text-[#0A1931]" : "border-[#E7EBF3] bg-white text-[#64748B]"}`}
          aria-label="Grid view"
        >
          <Grid className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("list")}
          className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-[16px] border ${viewMode === "list" ? "border-[#D4AF37] bg-[#FEF8E8] text-[#0A1931]" : "border-[#E7EBF3] bg-white text-[#64748B]"}`}
          aria-label="List view"
        >
          <List className="h-5 w-5" />
        </button>
        <button type="button" onClick={onClear} className="inline-flex h-[48px] items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
          Clear Filters
        </button>
      </div>
    </div>
  );
}

function ProductStatCards({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-6">
      {KPI_CARDS.map((card) => (
        <div key={card.label} className="flex min-h-[150px] flex-col justify-between rounded-[18px] border border-[#E7EBF3] bg-white p-5 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.12)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_-34px_rgba(15,23,42,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">{card.label}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#F8FAFC] text-[#0A1931] shadow-sm">
              <card.icon className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[28px] font-semibold tracking-[-0.03em] text-[#0A1931]">{stats[card.key as keyof typeof stats]}</p>
            <div className="flex items-center justify-between gap-3 text-sm text-[#475569]">
              <span className="font-semibold" style={{ color: card.color }}>{card.trend}</span>
              <span className="uppercase tracking-[0.28em]">vs last month</span>
            </div>
          </div>
          <div className="mt-4 h-12 overflow-hidden rounded-[14px] bg-[#F8FAFC] px-2 py-2">
            <svg viewBox="0 0 100 70" className="h-full w-full overflow-visible">
              <polyline fill="none" stroke={card.color} strokeWidth="3" strokeLinecap="round" points={statSparkline(card.sparkline)} />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductDistributionChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <div className={`${widgetBase} aspect-[4/3]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Product distribution</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Product distribution</h2>
        </div>
      </div>
      <div className="grid h-full gap-4 lg:grid-cols-[0.95fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[26px] bg-[#F8FAFC] p-4 shadow-inner shadow-slate-100">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={72} outerRadius={110} paddingAngle={8} stroke="transparent">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value} products`, "Products"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3 rounded-[22px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
          {data.map((segment) => (
            <div key={segment.name} className="flex items-center justify-between gap-3 rounded-[18px] bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <div>
                  <p className="text-sm font-semibold text-[#0A1931]">{segment.name}</p>
                  <p className="text-xs text-[#64748B]">{segment.value} products</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#0A1931]">{Math.round((segment.value / Math.max(data.reduce((sum, item) => sum + item.value, 0), 1)) * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductPerformanceChart({ data, activeRange, onChange }: { data: Record<ChartRange, ProductPerformanceSeries>; activeRange: ChartRange; onChange: (range: ChartRange) => void }) {
  return (
    <div className={`${widgetBase} aspect-[4/3]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Product performance</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Product performance</h2>
        </div>
        <div className="inline-flex rounded-full border border-[#E7EBF3] bg-[#F8FAFC] p-1">
          {(["monthly", "quarterly", "yearly"] as ChartRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onChange(range)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeRange === range ? "bg-[#0A1931] text-white" : "text-[#64748B] hover:bg-white"}`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[calc(100%-64px)] rounded-[24px] bg-[#F8FAFC] p-3 shadow-inner shadow-slate-100">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data[activeRange]} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563EB" stopOpacity={0.75} />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E7EBF3" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={(value) => value.toString()} />
            <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value} products`, "Products"]} />
            <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} fill="url(#performanceGradient)" fillOpacity={0.8} dot={false} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryPerformance({ data }: { data: Array<{ category: string; products: number; revenueShare: number; color: string }> }) {
  return (
    <div className={`${widgetBase} aspect-[4/3]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Category performance</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Category performance</h2>
        </div>
      </div>
      <div className="grid h-[calc(100%-56px)] gap-4 lg:grid-cols-[0.95fr_0.8fr]">
        <div className="relative overflow-hidden rounded-[24px] bg-[#F8FAFC] p-4 shadow-inner shadow-slate-100">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data} margin={{ left: -8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="#E7EBF3" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12 }} width={80} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${value}%`, `Revenue share`]} />
              <Bar dataKey="revenueShare" radius={[10, 10, 10, 10]} fill="#D4AF37">
                {data.map((entry) => (
                  <Cell key={entry.category} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          {data.map((item) => (
            <div key={item.category} className="rounded-[18px] border border-[#E7EBF3] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0A1931]">{item.category}</p>
                  <p className="text-xs text-[#64748B]">{item.products} products</p>
                </div>
                <span className="text-sm font-semibold text-[#0A1931]">{item.revenueShare}%</span>
              </div>
              <div className="mt-3 h-3.5 overflow-hidden rounded-full bg-[#F8FAFC]">
                <div className="h-full rounded-full" style={{ width: `${item.revenueShare}%`, backgroundColor: item.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopSellingProducts({ products }: { products: Array<{ id: number; name: string; image?: string; sales:number; revenue:number; status:string; brand:string }> }) {
  return (
    <div className={`${widgetBase} min-h-[330px]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Top selling products</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Top selling products</h2>
        </div>
      </div>
      <div className="space-y-4">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center gap-3 rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[16px] bg-white">
              {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-xs uppercase tracking-[0.24em] text-[#94A3AF]">IMG</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#0A1931]">{product.name}</p>
              <p className="mt-1 text-xs text-[#64748B]">{product.brand}</p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-sm font-semibold text-[#0A1931]">{product.sales} sales</p>
              <p className="text-xs text-[#64748B]">{formatCurrency(product.revenue)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandPerformance({ data }: { data: Array<{ brand: string; share: number; revenue: number; color: string }> }) {
  return (
    <div className={`${widgetBase} min-h-[330px]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Brand performance</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Brand performance</h2>
        </div>
      </div>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.brand} className="space-y-3 rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0A1931]">{item.brand}</p>
                <p className="text-xs text-[#64748B]">{formatCurrency(item.revenue)} revenue</p>
              </div>
              <p className="text-sm font-semibold text-[#0A1931]">{item.share}%</p>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full" style={{ width: `${item.share}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StockHealth({ items }: { items: Array<{ label: string; value: number; color: string; description: string }> }) {
  return (
    <div className={`${widgetBase} min-h-[330px]`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#94A3AF]">Stock health</p>
          <h2 className="mt-2 text-[22px] font-semibold text-[#0A1931]">Stock health</h2>
        </div>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0A1931]">{item.label}</p>
                <p className="text-xs text-[#64748B]">{item.description}</p>
              </div>
              <p className="text-lg font-semibold text-[#0A1931]">{item.value}%</p>
            </div>
            <div className="mt-4 h-3.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsGrid({ products, onOpenDrawer, selectedIds, onToggleSelect, allSelected, onToggleSelectAll }: {
  products: ProductRecord[];
  onOpenDrawer: (product: ProductRecord | null) => void;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  allSelected: boolean;
  onToggleSelectAll: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[16px] border border-[#E7EBF3] bg-white p-4 shadow-[0_16px_40px_-26px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 text-sm text-[#64748B]">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" />
            <span>{selectedIds.length} selected</span>
          </div>
          <button type="button" onClick={() => onOpenDrawer(null)} className="inline-flex items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 py-2 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37]">
            Export Selected
          </button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {products.map((product) => {
          const status = String(product.status || "ACTIVE").toUpperCase();
          const pillColor = status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : status === "DRAFT" ? "bg-slate-100 text-slate-700" : status === "LOW_STOCK" ? "bg-orange-100 text-orange-700" : "bg-rose-100 text-rose-700";
          return (
            <div key={product.id} className="group overflow-hidden rounded-[20px] border border-[#E7EBF3] bg-white shadow-[0_16px_40px_-26px_rgba(15,23,42,0.08)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_44px_-26px_rgba(15,23,42,0.12)]">
              <div className="relative overflow-hidden rounded-t-[20px] bg-[#F8FAFC]" style={{ minHeight: 180 }}>
                <img src={product.images?.[0] || "https://via.placeholder.com/320x180"} alt={product.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#94A3AF]">{product.brand?.name || "House of Valerion"}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#0A1931]">{product.name || "Untitled product"}</h3>
                  </div>
                  <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => onToggleSelect(product.id)} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" />
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#64748B]">
                  <p>SKU: {product.sku || "—"}</p>
                  <p>Category: {product.category?.name || "—"}</p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[22px] font-semibold text-[#0A1931]">{formatCurrency(product.price)}</p>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${pillColor}`}>{status.replace("_", " ")}</span>
                </div>
                <button type="button" onClick={() => onOpenDrawer(product)} className="mt-5 inline-flex h-[44px] w-full items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
                  View details
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductsTable({ products, selectedIds, onToggleSelect, onToggleSelectAll, allSelected, exportSelected, onDelete, onSetDrawerProduct, pagination }: ProductsTableProps) {
  return (
    <div className="rounded-[16px] border border-[#E7EBF3] bg-white shadow-[0_16px_40px_-26px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 border-b border-[#E7EBF3] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-sm text-[#64748B]">
          <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" />
          {selectedIds.length} selected
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportSelected} className="inline-flex h-[44px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
            Export Selected
          </button>
          <button type="button" className="inline-flex h-[44px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:text-[#0A1931]">
            Bulk Actions
          </button>
        </div>
      </div>
      <div className="overflow-x-hidden">
        <table className="w-full min-w-0 table-auto border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20 bg-white text-left text-[11px] uppercase tracking-[0.28em] text-[#64748B]">
            <tr className="border-b border-[#E7EBF3]">
              <th className="sticky left-0 z-30 w-14 bg-white px-4 py-4"><input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" /></th>
              <th className="w-[12%] px-4 py-4">Product</th>
              <th className="w-[18%] px-4 py-4">Name</th>
              <th className="w-[8%] px-4 py-4">SKU</th>
              <th className="w-[10%] px-4 py-4">Category</th>
              <th className="w-[10%] px-4 py-4">Brand</th>
              <th className="w-[8%] px-4 py-4">Price</th>
              <th className="w-[8%] px-4 py-4">Stock</th>
              <th className="w-[8%] px-4 py-4">Status</th>
              <th className="w-[6%] px-4 py-4">Rating</th>
              <th className="w-[8%] px-4 py-4">Sales</th>
              <th className="w-[10%] px-4 py-4">Last Updated</th>
              <th className="w-16 px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const price = Number(product.price || 0);
              const stockStatus = String(product.status || "ACTIVE").toUpperCase();
              const badgeClass = stockStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : stockStatus === "DRAFT" ? "bg-slate-100 text-slate-700" : stockStatus === "LOW_STOCK" ? "bg-orange-100 text-orange-700" : "bg-rose-100 text-rose-700";
              const rating = Math.min(5, 3 + (product.id % 3) + 0.3);
              const sales = 120 - ((product.id % 12) * 4);
              return (
                <tr key={product.id} className={`${index % 2 === 0 ? "bg-[#FCFCFE]" : "bg-white"} transition duration-200 hover:bg-[#F8FAFC]`}>
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-4"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => onToggleSelect(product.id)} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" /></td>
                  <td className="px-4 py-4">
                    <div className="flex h-13 w-13 items-center justify-center overflow-hidden rounded-[12px] bg-[#F8FAFC]">
                      {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="text-xs uppercase tracking-[0.24em] text-[#94A3AF]">No image</div>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[220px] truncate text-sm font-semibold text-[#0A1931]">{product.name || "Untitled product"}</div>
                  </td>
                  <td className="px-4 py-4 text-[#0A1931]">{product.sku || "—"}</td>
                  <td className="px-4 py-4 text-[#64748B]">{product.category?.name || "—"}</td>
                  <td className="px-4 py-4 text-[#0A1931]">{product.brand?.name || "—"}</td>
                  <td className="px-4 py-4 text-[#0A1931]">{formatCurrency(price)}</td>
                  <td className="px-4 py-4 text-[#0A1931]">{Number(product.countInStock ?? 0)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${badgeClass}`}>{stockStatus.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-4 text-[#0A1931]">{rating.toFixed(1)}</td>
                  <td className="px-4 py-4 text-[#0A1931]">{sales}</td>
                  <td className="px-4 py-4 text-[#64748B]">{formatDateLabel(product.updatedAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => onSetDrawerProduct(product)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E7EBF3] bg-[#F8FAFC] text-[#0A1931] transition duration-200 hover:border-[#D4AF37] hover:bg-white">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-4 border-t border-[#E7EBF3] p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#64748B]">Showing {products.length} products on this page</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} className="inline-flex h-[44px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:bg-[#F8FAFC]">Previous</button>
          {Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button key={pageNumber} type="button" onClick={() => pagination.onPageChange(pageNumber)} className={`inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition ${pagination.page === pageNumber ? "bg-[#0A1931] text-white" : "border border-[#E7EBF3] bg-white text-[#0A1931] hover:bg-[#F8FAFC]"}`}>
              {pageNumber}
            </button>
          ))}
          <button onClick={() => pagination.onPageChange(Math.min(pagination.pageCount, pagination.page + 1))} className="inline-flex h-[44px] items-center justify-center rounded-[14px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition duration-200 hover:bg-[#F8FAFC]">Next</button>
          <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))} className="h-[44px] rounded-[14px] border border-[#E7EBF3] bg-white px-3 text-sm text-[#0A1931] outline-none shadow-sm">
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function LuxuryProductsHeader({
  selectedCount,
  onCreate,
  onImport,
  onExport,
  readOnly = false,
}: {
  selectedCount: number;
  onCreate: () => void;
  onImport: () => void;
  onExport: () => void;
  readOnly?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
    >
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0F172A]">
            <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            House of Valerion • Catalogue
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-4xl">Products</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#6B7280]">
            Manage luxury collections with a refined operational view for inventory, pricing, and presentation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!readOnly && <button type="button" onClick={onImport} className="inline-flex h-[46px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
            <Upload className="mr-2 h-4 w-4 text-[#0F172A]" /> Import
          </button>}
          <button type="button" onClick={onExport} className="inline-flex h-[46px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
            <Download className="mr-2 h-4 w-4 text-[#0F172A]" /> Export
          </button>
          {!readOnly && <button type="button" onClick={onCreate} className="inline-flex h-[46px] items-center justify-center rounded-[14px] bg-[#0F172A] px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition duration-200 hover:bg-[#111827]">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </button>}
        </div>
      </div>
      {selectedCount > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-3 text-sm text-[#4B5563]">
          <span>{selectedCount} product{selectedCount > 1 ? "s" : ""} selected for bulk operations.</span>
          <span className="font-semibold text-[#111827]">Ready to publish, archive, or export.</span>
        </div>
      )}
    </motion.div>
  );
}

function LuxuryProductFilters({
  query,
  onQueryChange,
  categoryFilter,
  brandFilter,
  collectionFilter,
  statusFilter,
  priceRange,
  priceBounds,
  sortBy,
  categoryOptions,
  brandOptions,
  collectionOptions,
  onCategoryChange,
  onBrandChange,
  onCollectionChange,
  onStatusChange,
  onPriceRangeChange,
  onSortChange,
  onClear,
  readOnly = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string;
  brandFilter: string;
  collectionFilter: string;
  statusFilter: string;
  priceRange: [number, number];
  priceBounds: [number, number];
  sortBy: string;
  categoryOptions: string[];
  brandOptions: string[];
  collectionOptions: string[];
  onCategoryChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onCollectionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onSortChange: (value: string) => void;
  onClear: () => void;
  readOnly?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04, duration: 0.35 }}
      className="sticky top-4 z-20 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur"
    >
      <div className="pointer-events-none absolute right-4 top-4 text-[72px] font-semibold uppercase tracking-[0.4em] text-[#0F172A]/5">HV</div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, SKU, category, brand, collection or tags"
            className="h-[48px] w-full rounded-[16px] border border-[#E5E7EB] bg-[#FFFFFF] pl-11 pr-4 text-sm text-[#111827] outline-none transition duration-200 placeholder:text-[#6B7280] focus:border-[#D4AF37]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex h-[46px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30">
            <Filter className="mr-2 h-4 w-4 text-[#0F172A]" /> Refine
          </button>
          <button type="button" onClick={onClear} className="inline-flex h-[46px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30">
            Reset
          </button>
          {!readOnly && <button type="button" className="inline-flex h-[46px] items-center justify-center rounded-[14px] bg-[#0F172A] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition duration-200 hover:bg-[#111827] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </button>}
        </div>
      </div>
      <div className="mt-4 grid w-full max-w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <select value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)} className="h-[46px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]">
          <option value="">Category</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={brandFilter} onChange={(event) => onBrandChange(event.target.value)} className="h-[46px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]">
          <option value="">Brand</option>
          {brandOptions.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <select value={collectionFilter} onChange={(event) => onCollectionChange(event.target.value)} className="h-[46px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]">
          <option value="">Collection</option>
          {collectionOptions.map((collection) => (
            <option key={collection} value={collection}>
              {collection}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => onStatusChange(event.target.value)} className="h-[46px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]">
          <option value="">Status</option>
          <option value="ACTIVE">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="LOW_STOCK">Low Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>
        <select value={sortBy} onChange={(event) => onSortChange(event.target.value)} className="h-[46px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]">
          <option value="newest">Newest</option>
          <option value="priceAsc">Price: Low to High</option>
          <option value="priceDesc">Price: High to Low</option>
          <option value="stockAsc">Stock: Low to High</option>
          <option value="stockDesc">Stock: High to Low</option>
        </select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="number"
          value={priceRange[0]}
          onChange={(event) => onPriceRangeChange([clamp(Number(event.target.value), priceBounds[0], priceRange[1]), priceRange[1]])}
          placeholder="Min price"
          className="h-[46px] w-full min-w-0 max-w-[140px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]"
        />
        <input
          type="number"
          value={priceRange[1]}
          onChange={(event) => onPriceRangeChange([priceRange[0], clamp(Number(event.target.value), priceRange[0], priceBounds[1])])}
          placeholder="Max price"
          className="h-[46px] w-full min-w-0 max-w-[140px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none transition duration-200 focus:border-[#D4AF37]"
        />
      </div>
    </motion.div>
  );
}

function formatStatValue(key: string, value: number) {
  if (key === "revenue" || key === "inventoryValue") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  }
  return value.toLocaleString("en-IN");
}

function LuxuryStatsCards({ stats }: { stats: Record<string, number> }) {
  const cards = [
    { label: "Total Products", icon: Package, key: "total", trend: "+8.2%", sparkline: [12, 14, 17, 18, 21, 24, 28], color: "#D4AF37", description: "Active catalogue entries" },
    { label: "Published", icon: CheckCircle2, key: "published", trend: "+5.4%", sparkline: [18, 19, 21, 22, 24, 26, 29], color: "#0F172A", description: "Live on storefront" },
    { label: "Draft", icon: Sparkles, key: "drafts", trend: "-1.2%", sparkline: [8, 7, 8, 9, 9, 8, 7], color: "#F59E0B", description: "Pending approvals" },
    { label: "Low Stock", icon: Tag, key: "lowStock", trend: "-3.8%", sparkline: [6, 7, 7, 6, 5, 5, 4], color: "#EF4444", description: "Reorder soon" },
    { label: "Out of Stock", icon: Archive, key: "outOfStock", trend: "-1.4%", sparkline: [3, 3, 2, 2, 2, 1, 1], color: "#2563EB", description: "Unavailable SKUs" },
    { label: "Revenue", icon: TrendingUp, key: "revenue", trend: "+12.4%", sparkline: [4, 6, 7, 8, 9, 10, 12], color: "#22C55E", description: "Estimated sales value" },
    { label: "Inventory Value", icon: BarChart3, key: "inventoryValue", trend: "+6.1%", sparkline: [5, 6, 7, 8, 9, 10, 11], color: "#0F172A", description: "Current stock valuation" },
    { label: "Collections", icon: FileText, key: "collections", trend: "+2.1%", sparkline: [3, 4, 4, 4, 5, 5, 6], color: "#D4AF37", description: "Active launches" },
  ];

  return (
    <div className="grid w-full max-w-full min-w-0 gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="group w-full min-w-0 overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition duration-200 hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-[0_16px_45px_rgba(15,23,42,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#6B7280]">{card.label}</p>
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#111827]">{formatStatValue(card.key, stats[card.key] ?? 0)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#F8F9FB] text-[#0F172A] transition duration-200 group-hover:bg-[#FFF8E8]">
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-[#6B7280]">{card.description}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold" style={{ color: card.color }}>{card.trend}</span>
              <span className="text-[#6B7280]">vs last month</span>
            </div>
            <div className="mt-4 h-10 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F8F9FB] px-2 py-2">
              <svg viewBox="0 0 100 70" className="h-full w-full overflow-visible">
                <polyline fill="none" stroke={card.color} strokeWidth="3" strokeLinecap="round" points={statSparkline(card.sparkline)} />
              </svg>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function LuxuryAnalyticsCharts({
  distributionData,
  performanceData,
  activeRange,
  onChange,
  categoryPerformance,
  stockHealthItems,
}: {
  distributionData: Array<{ name: string; value: number; color: string }>;
  performanceData: Record<ChartRange, ProductPerformanceSeries>;
  activeRange: ChartRange;
  onChange: (range: ChartRange) => void;
  categoryPerformance: Array<{ category: string; products: number; revenueShare: number; color: string }>;
  stockHealthItems: Array<{ label: string; value: number; color: string; description: string }>;
}) {
  const inventoryValue = stockHealthItems.reduce((sum, item) => sum + item.value, 0);
  const healthyPercent = Math.round((inventoryValue / 300) * 100);
  const totalProducts = distributionData.reduce((sum, item) => sum + item.value, 0);
  const publishedCount = distributionData.find((item) => item.name === "Published")?.value ?? 0;
  const publishedPercent = totalProducts ? Math.round((publishedCount / totalProducts) * 100) : 0;
  const series = performanceData[activeRange];
  const firstValue = series[0]?.value ?? 0;
  const lastValue = series[series.length - 1]?.value ?? 0;
  const growth = firstValue ? Math.round(((lastValue - firstValue) / firstValue) * 100) : 0;
  const peakPoint = series.reduce((best, point) => (point.value > best.value ? point : best), series[0] ?? { label: "—", value: 0 });
  const headlineCategories = categoryPerformance.slice(0, 4);
  const coverageMetrics = [
    { label: "Healthy", value: Math.max(0, healthyPercent), progress: Math.max(0, healthyPercent), icon: CheckCircle2, accent: "text-emerald-600" },
    { label: "Low stock", value: Math.max(0, 100 - healthyPercent), progress: Math.max(0, 100 - healthyPercent), icon: Tag, accent: "text-amber-600" },
    { label: "Pending", value: Math.max(0, 12), progress: 12, icon: Sparkles, accent: "text-slate-600" },
    { label: "Out of stock", value: Math.max(0, 5), progress: 5, icon: Archive, accent: "text-rose-600" },
  ];
  const insightCards = [
    { label: "Best category", value: headlineCategories[0]?.category ?? "Signature", hint: "Highest share" },
    { label: "Top product", value: "Heritage Blazer", hint: "Fastest velocity" },
    { label: "Revenue today", value: formatCurrency(265000), hint: "+14% vs yesterday" },
    { label: "Most viewed", value: "Monarch Suit", hint: "1.8K views" },
    { label: "Highest margin", value: "18.4%", hint: "Premium edit" },
    { label: "Average inventory", value: "82 units", hint: "Healthy pace" },
  ];

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="grid gap-6 xl:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.35 }} className="flex h-[460px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Revenue trend</p>
              <h2 className="mt-2 font-serif text-[30px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Monthly revenue</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#64748B]">Luxury growth pacing, peak demand windows, and momentum by month.</p>
            </div>
            <div className="flex rounded-full border border-[#E5E7EB] bg-[#F8F9FB] p-1">
              {(["monthly", "quarterly", "yearly"] as ChartRange[]).map((range) => (
                <button key={range} type="button" onClick={() => onChange(range)} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${activeRange === range ? "bg-[#0F172A] text-white" : "text-[#6B7280] hover:bg-white"}`}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex-1 min-h-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={series} margin={{ top: 8, right: 10, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="luxuryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.98} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number | string) => [formatCurrency(Number(value)), "Revenue"]} />
                <Area type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={3.2} fill="url(#luxuryGradient)" fillOpacity={0.95} dot={false} activeDot={{ r: 6 }} isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#FFFDF8] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280]">Revenue</p>
              <p className="mt-2 text-[20px] font-semibold text-[#111827]">{formatCurrency(lastValue * 1000)}</p>
            </div>
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#FFFDF8] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280]">Growth</p>
              <p className="mt-2 text-[20px] font-semibold text-[#111827]">+{growth}%</p>
            </div>
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#FFFDF8] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280]">Best month</p>
              <p className="mt-2 text-[20px] font-semibold text-[#111827]">{peakPoint.label}</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }} className="flex h-[460px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Inventory health</p>
            <h2 className="mt-2 font-serif text-[30px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Healthy inventory</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">A balanced view of stock coverage, replenishment risk, and readiness.</p>
          </div>

          <div className="mt-5 flex flex-1 min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8F9FB] p-5">
            <div className="flex flex-1 items-center justify-center">
              <div className="relative flex h-[220px] w-[220px] items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-[220px] w-[220px] -rotate-90">
                  <circle cx="70" cy="70" r="54" stroke="#E5E7EB" strokeWidth="14" fill="none" />
                  <motion.circle cx="70" cy="70" r="54" stroke="#D4AF37" strokeWidth="14" strokeLinecap="round" fill="none" strokeDasharray={2 * Math.PI * 54} initial={{ strokeDashoffset: 2 * Math.PI * 54 }} animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - healthyPercent / 100) }} transition={{ duration: 1.2, ease: "easeOut" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[34px] font-semibold tracking-[-0.02em] text-[#111827]">{healthyPercent}%</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Healthy</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {stockHealthItems.map((item) => (
                <div key={item.label} className="rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#111827]">{item.value}%</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }} className="flex h-[360px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Category distribution</p>
            <h2 className="mt-2 font-serif text-[28px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Top segments</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">A premium breakdown of the strongest revenue contributors.</p>
          </div>
          <div className="mt-4 flex-1 space-y-3">
            {headlineCategories.map((item, index) => (
              <motion.div key={item.category} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.14 + index * 0.05, duration: 0.25 }} whileHover={{ y: -2, scale: 1.01 }} className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{item.category}</p>
                      <p className="text-xs text-[#64748B]">{item.products} products</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#111827]">{item.revenueShare}%</p>
                    <p className="text-xs text-[#64748B]">share</p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${item.revenueShare}%` }} transition={{ duration: 0.7, delay: 0.16 + index * 0.06 }} className="h-full rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.35 }} className="flex h-[360px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Collection performance</p>
            <h2 className="mt-2 font-serif text-[28px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Best sellers</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">Rounded bars with clear values and elegant spacing.</p>
          </div>
          <div className="mt-4 flex-1 min-h-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={headlineCategories} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="collectionBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.96} />
                    <stop offset="100%" stopColor="#F5E8B8" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5E7EB" vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 10 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value: number | string) => [`${value}% share`, "Share"]} />
                <Bar dataKey="revenueShare" radius={[12, 12, 0, 0]} fill="url(#collectionBarGradient)" maxBarSize={70} isAnimationActive animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }} className="flex h-[360px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Publication health</p>
            <h2 className="mt-2 font-serif text-[28px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Live readiness</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">The live balance of product publishing and stock risk.</p>
          </div>

          <div className="mt-4 flex flex-1 min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
            <div className="flex flex-1 items-center justify-center">
              <div className="relative flex h-[170px] w-[170px] items-center justify-center">
                <svg viewBox="0 0 140 140" className="h-[170px] w-[170px] -rotate-90">
                  <circle cx="70" cy="70" r="54" stroke="#E5E7EB" strokeWidth="14" fill="none" />
                  <motion.circle cx="70" cy="70" r="54" stroke="#0F172A" strokeWidth="14" strokeLinecap="round" fill="none" strokeDasharray={2 * Math.PI * 54} initial={{ strokeDashoffset: 2 * Math.PI * 54 }} animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - publishedPercent / 100) }} transition={{ duration: 1.1, ease: "easeOut" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[30px] font-semibold tracking-[-0.02em] text-[#111827]">{publishedPercent}%</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Published</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: "Draft", value: distributionData.find((item) => item.name === "Draft")?.value ?? 0 },
                { label: "Low stock", value: distributionData.find((item) => item.name === "Low Stock")?.value ?? 0 },
                { label: "Total", value: totalProducts },
                { label: "Healthy", value: healthyPercent },
              ].map((metric) => (
                <div key={metric.label} className="rounded-[14px] border border-[#E5E7EB] bg-white px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#111827]">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.35 }} className="flex h-[320px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Inventory coverage</p>
            <h2 className="mt-2 font-serif text-[28px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Coverage snapshot</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">A clearer distribution of operational health across the catalogue.</p>
          </div>
          <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
            {coverageMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <motion.div key={metric.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 + index * 0.04, duration: 0.25 }} whileHover={{ y: -3, scale: 1.01 }} className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-[12px] bg-white ${metric.accent}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-[#111827]">{metric.value}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${metric.progress}%` }} transition={{ duration: 0.6, delay: 0.28 + index * 0.04 }} className="h-full rounded-full bg-[#D4AF37]" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[#64748B]">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Live trend</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, duration: 0.35 }} className="flex h-[320px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_16px_45px_rgba(15,23,42,0.06)] xl:col-span-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-[#6B7280]">Quick insights</p>
            <h2 className="mt-2 font-serif text-[28px] font-semibold tracking-[-0.02em] text-[#111827]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Priority signals</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">Executive-ready highlights for the next decision point.</p>
          </div>
          <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
            {insightCards.map((item, index) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + index * 0.04, duration: 0.25 }} whileHover={{ y: -3, scale: 1.01 }} className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-3">
                <div className="flex items-center gap-2 text-[#0F172A]">
                  {index === 0 ? <Star className="h-4 w-4" /> : index === 1 ? <Eye className="h-4 w-4" /> : index === 2 ? <TrendingUp className="h-4 w-4" /> : index === 3 ? <Heart className="h-4 w-4" /> : index === 4 ? <Sparkles className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">{item.label}</p>
                </div>
                <p className="mt-3 text-[16px] font-semibold text-[#111827]">{item.value}</p>
                <p className="mt-1 text-xs text-[#64748B]">{item.hint}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function InventoryHealth({ items }: { items: Array<{ label: string; value: number; color: string; description: string }> }) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Inventory health</p>
        <h3 className="mt-2 text-lg font-semibold text-[#111827]">Coverage and risk</h3>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold text-[#111827]">{item.label}</p>
                <p className="mt-1 text-[#6B7280]">{item.description}</p>
              </div>
              <span className="text-lg font-semibold text-[#0F172A]">{item.value}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LuxuryTopSellingProducts({ products }: { products: Array<{ id: number; name: string; image?: string; sales: number; revenue: number; status: string; brand: string }> }) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Signal cards</p>
          <h3 className="mt-2 text-lg font-semibold text-[#111827]">Top sellers</h3>
        </div>
      </div>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.id} className="flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] bg-[#FFFFFF]">
              {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-5 w-5 text-[#6B7280]" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#111827]">{product.name}</p>
              <p className="mt-1 text-xs text-[#6B7280]">{product.brand}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#0F172A]">{product.sales} sold</p>
              <p className="mt-1 text-xs text-[#6B7280]">{formatCurrency(product.revenue)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentProducts({ products }: { products: ProductRecord[] }) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Recent activity</p>
        <h3 className="mt-2 text-lg font-semibold text-[#111827]">Latest additions</h3>
      </div>
      <div className="space-y-2">
        {products.slice(0, 4).map((product) => {
          const status = String(product.status || "ACTIVE").toUpperCase();
          const badgeClass = status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "DRAFT" ? "border-[#E5E7EB] bg-white text-[#4B5563]" : "border-amber-200 bg-amber-50 text-amber-700";
          return (
            <div key={product.id} className="group flex items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3 transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white shadow-sm">
                {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" loading="lazy" /> : <Package className="h-5 w-5 text-[#6B7280]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111827]">{product.name || "Untitled product"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]">
                  <span className="rounded-full border border-[#E5E7EB] bg-white px-2 py-0.5">{product.category?.name || "Uncategorized"}</span>
                  <span className={`rounded-full border px-2 py-0.5 ${badgeClass}`}>{status.replace("_", " ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6B7280]">{formatDateLabel(product.updatedAt)}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#0F172A] transition duration-200 group-hover:border-[#D4AF37] group-hover:bg-[#FFF8E8]">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LowStockAlerts({ products }: { products: ProductRecord[] }) {
  const lowStockProducts = products.filter((product) => Number(product.countInStock ?? 0) <= 5).slice(0, 4);

  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FFFFFF] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Inventory</p>
          <h3 className="mt-1 text-base font-semibold text-[#111827]">Low stock alerts</h3>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{lowStockProducts.length}</span>
      </div>
      <div className="space-y-2">
        {lowStockProducts.length ? lowStockProducts.map((product) => (
          <div key={product.id} className="flex items-center justify-between rounded-[14px] border border-[#E5E7EB] bg-[#F8F9FB] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{product.name || "Untitled product"}</p>
              <p className="text-xs text-[#6B7280]">{product.sku || "SKU pending"}</p>
            </div>
            <span className="text-sm font-semibold text-amber-700">{product.countInStock ?? 0}</span>
          </div>
        )) : (
          <div className="rounded-[14px] border border-dashed border-[#E5E7EB] bg-[#F8F9FB] px-3 py-4 text-sm text-[#6B7280]">No urgent items right now.</div>
        )}
      </div>
    </div>
  );
}

function QuickActionsCard({ selectedCount, onPublish, onArchive, onDuplicate, onAssignCollection, onAssignCategory, onExport, onDelete }: { selectedCount: number; onPublish: () => void; onArchive: () => void; onDuplicate: () => void; onAssignCollection: () => void; onAssignCategory: () => void; onExport: () => void; onDelete: () => void }) {
  const actions = [
    { label: "Publish Selected", icon: CheckCircle2, onClick: onPublish, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Archive Selected", icon: Archive, onClick: onArchive, tone: "bg-amber-50 text-amber-700" },
    { label: "Duplicate", icon: Copy, onClick: onDuplicate, tone: "bg-slate-50 text-slate-700" },
    { label: "Assign Collection", icon: Sparkles, onClick: onAssignCollection, tone: "bg-violet-50 text-violet-700" },
    { label: "Assign Category", icon: Tag, onClick: onAssignCategory, tone: "bg-blue-50 text-blue-700" },
    { label: "Export CSV", icon: Download, onClick: onExport, tone: "bg-[#FFF8E8] text-[#0F172A]" },
    { label: "Delete Selected", icon: Trash2, onClick: onDelete, tone: "bg-rose-50 text-rose-700" },
  ];

  return (
    <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FFFFFF] p-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Operations</p>
          <h3 className="mt-1 text-base font-semibold text-[#111827]">Quick actions</h3>
        </div>
        {selectedCount > 0 ? <span className="rounded-full bg-[#FFF8E8] px-2.5 py-1 text-xs font-semibold text-[#0F172A]">{selectedCount} selected</span> : null}
      </div>
      <div className="grid gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} type="button" onClick={action.onClick} className={`flex items-center justify-between rounded-[14px] border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#111827] transition duration-200 hover:-translate-y-0.5 hover:bg-[#FFF8E8] ${action.tone}`}>
              <span>{action.label}</span>
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LuxuryQuickInsights({
  stats,
  stockHealthItems,
  topSellingProducts,
  recentProducts,
  categoryPerformance,
  brandPerformance,
  selectedCount,
  onPublish,
  onArchive,
  onDuplicate,
  onAssignCollection,
  onAssignCategory,
  onExport,
  onDelete,
  readOnly = false,
}: {
  stats: Record<string, number>;
  stockHealthItems: Array<{ label: string; value: number; color: string; description: string }>;
  topSellingProducts: Array<{ id: number; name: string; image?: string; sales: number; revenue: number; status: string; brand: string }>;
  recentProducts: ProductRecord[];
  categoryPerformance: Array<{ category: string; products: number; revenueShare: number; color: string }>;
  brandPerformance: Array<{ brand: string; share: number; revenue: number; color: string }>;
  selectedCount: number;
  onPublish: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onAssignCollection: () => void;
  onAssignCategory: () => void;
  onExport: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const publishedPercent = stats.total ? Math.round((stats.published / stats.total) * 100) : 0;
  const draftPercent = stats.total ? Math.round((stats.drafts / stats.total) * 100) : 0;
  const lowStockPercent = stats.total ? Math.round((stats.lowStock / stats.total) * 100) : 0;

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.35 }} className="rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Quick insights</p>
            <h2 className="mt-1 font-serif text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">Performance pulse</h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">High-value operational insights for the current catalogue state.</p>
          </div>
          <div className="rounded-full bg-[#FFF8E8] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#0F172A]">Live</div>
        </div>
        <div className="mt-4 rounded-[22px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
          <div className="flex items-center justify-center">
            <div className="relative flex h-[180px] w-[180px] items-center justify-center">
              <svg viewBox="0 0 140 140" className="h-[180px] w-[180px] -rotate-90">
                <circle cx="70" cy="70" r="54" stroke="#E5E7EB" strokeWidth="14" fill="none" />
                <motion.circle cx="70" cy="70" r="54" stroke="#D4AF37" strokeWidth="14" strokeLinecap="round" fill="none" strokeDasharray={2 * Math.PI * 54} initial={{ strokeDashoffset: 2 * Math.PI * 54 }} animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - publishedPercent / 100) }} transition={{ duration: 1.1, ease: "easeOut" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[30px] font-semibold tracking-[-0.02em] text-[#111827]">{publishedPercent}%</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#6B7280]">Published</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Draft</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{draftPercent}%</p>
            </div>
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Low stock</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{lowStockPercent}%</p>
            </div>
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Total</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{stats.total}</p>
            </div>
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Healthy</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{Math.max(0, 100 - lowStockPercent)}%</p>
            </div>
          </div>
        </div>
      </motion.div>
      <InventoryHealth items={stockHealthItems} />
      <LowStockAlerts products={recentProducts} />
      {!readOnly && <QuickActionsCard selectedCount={selectedCount} onPublish={onPublish} onArchive={onArchive} onDuplicate={onDuplicate} onAssignCollection={onAssignCollection} onAssignCategory={onAssignCategory} onExport={onExport} onDelete={onDelete} />}
      <RecentProducts products={recentProducts.slice(0, 3)} />
    </div>
  );
}

function LuxuryProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allSelected,
  exportSelected,
  onDelete,
  onPreview,
  onEdit,
  onDuplicate,
  onArchive,
  readOnly = false,
  pagination,
}: {
  products: ProductRecord[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  exportSelected: () => void;
  onDelete: (id: number) => void;
  onPreview: (product: ProductRecord) => void;
  onEdit: (product: ProductRecord) => void;
  onDuplicate: (product: ProductRecord) => void;
  onArchive: (product: ProductRecord) => void;
  readOnly?: boolean;
  pagination: { page: number; pageCount: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void };
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }} className="w-full min-w-0 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-[#F8F9FB]/80 px-4 py-3 shadow-[0_6px_20px_-12px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-3 text-sm text-[#4B5563]">
          <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" />
          <span>{selectedIds.length} selected</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportSelected} className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Export</button>
          {!readOnly && <button type="button" className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Bulk actions</button>}
        </div>
      </div>
      <div className="max-h-[560px] overflow-y-auto overflow-x-hidden">
        <table className="w-full min-w-0 table-fixed border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-[#F8F9FB] text-left text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">
            <tr>
              <th className="w-[40px] px-3 py-3"><input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" /></th>
              <th className="w-[60px] px-3 py-3">Image</th>
              <th className="w-[240px] px-3 py-3">Product</th>
              <th className="w-[90px] px-3 py-3">SKU</th>
              <th className="w-[120px] px-3 py-3">Category</th>
              <th className="w-[100px] px-3 py-3">Brand</th>
              <th className="w-[120px] px-3 py-3">Collection</th>
              <th className="w-[80px] px-3 py-3">Stock</th>
              <th className="w-[90px] px-3 py-3">Price</th>
              <th className="w-[100px] px-3 py-3">Status</th>
              <th className="w-[150px] px-3 py-3">Updated</th>
              <th className="w-[140px] px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const status = String(product.status || "ACTIVE").toUpperCase();
              const stockValue = Number(product.countInStock ?? 0);
              const stockTone = stockValue <= 0 ? "bg-rose-500" : stockValue <= 5 ? "bg-amber-500" : "bg-emerald-500";
              const badgeClass = status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "DRAFT" ? "border-[#E5E7EB] bg-[#F8F9FB] text-[#4B5563]" : status === "LOW_STOCK" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700";
              return (
                <tr key={product.id} className={`${index % 2 === 0 ? "bg-[#F8F9FB]" : "bg-[#FFFFFF]"} h-[72px] transition duration-200 hover:bg-[#FFF8E8]`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => onToggleSelect(product.id)} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" /></td>
                  <td className="px-3 py-2">
                    <div className="flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm">
                      {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : <Package className="h-5 w-5 text-[#6B7280]" />}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#111827]">{product.name || "Untitled product"}</p>
                      <p className="mt-0.5 truncate text-xs text-[#6B7280]">{product.collection || "Heritage collection"}</p>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#4B5563]">{product.sku || "—"}</td>
                  <td className="px-3 py-2 text-[#4B5563]">{product.category?.name || "—"}</td>
                  <td className="px-3 py-2 text-[#4B5563]">{product.brand?.name || "—"}</td>
                  <td className="px-3 py-2 text-[#4B5563]">{product.collection || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 text-[#4B5563]">
                      <span className={`h-2.5 w-2.5 rounded-full ${stockTone}`} />
                      <span>{stockValue}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[#111827]">{formatCurrency(product.price)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${badgeClass}`}>{status.replace("_", " ")}</span>
                  </td>
                  <td className="px-3 py-2 text-[#6B7280]">{formatDateLabel(product.updatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" title="Preview" onClick={() => onPreview(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                        <Eye className="h-4 w-4" />
                      </button>
                      {!readOnly && <button type="button" title="Edit" onClick={() => onEdit(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                        <Edit className="h-4 w-4" />
                      </button>}
                      {!readOnly && <button type="button" title="Duplicate" onClick={() => onDuplicate(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                        <Copy className="h-4 w-4" />
                      </button>}
                      {!readOnly && <button type="button" title="Publish" onClick={() => onArchive(product)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#111827] transition duration-200 hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>}
                      {!readOnly && <button type="button" title="Delete" onClick={() => onDelete(product.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition duration-200 hover:bg-rose-100">
                        <Trash2 className="h-4 w-4" />
                      </button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-4 border-t border-[#E5E7EB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#6B7280]">Showing {products.length} products on this page</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Previous</button>
          {Array.from({ length: pagination.pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button key={pageNumber} type="button" onClick={() => pagination.onPageChange(pageNumber)} className={`inline-flex h-[40px] min-w-[40px] items-center justify-center rounded-[12px] px-3 text-sm font-semibold transition ${pagination.page === pageNumber ? "bg-[#0F172A] text-white" : "border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F8F9FB]"}`}>
              {pageNumber}
            </button>
          ))}
          <button type="button" onClick={() => pagination.onPageChange(Math.min(pagination.pageCount, pagination.page + 1))} className="inline-flex h-[40px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Next</button>
          <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))} className="h-[40px] rounded-[12px] border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] outline-none">
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>
        </div>
      </div>
    </motion.div>
  );
}

function LuxuryEmptyState({ onCreate, readOnly = false }: { onCreate: () => void; readOnly?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="rounded-[24px] border border-dashed border-[#E5E7EB] bg-[#FFFFFF] p-10 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8F9FB] text-[#0F172A]">
        <Package className="h-8 w-8" />
      </div>
      <h3 className="mt-6 text-2xl font-semibold text-[#111827]">No products have been added yet.</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#6B7280]">{readOnly ? "Products are available for inspection in the selected parent context." : "Your catalog is ready for a luxury launch. Create the first collection entry and begin curating premium inventory."}</p>
      {!readOnly && <button type="button" onClick={onCreate} className="mt-6 inline-flex h-[46px] items-center justify-center rounded-[14px] bg-[#0F172A] px-5 text-sm font-semibold text-white transition duration-200 hover:bg-[#111827]">
        <Plus className="mr-2 h-4 w-4" /> Add First Product
      </button>}
    </motion.div>
  );
}

function LuxuryPreviewDrawer({ product, onClose, readOnly = false }: { product: ProductRecord | null; onClose: () => void; readOnly?: boolean }) {
  if (!product) return null;

  const gallery = product.images?.slice(0, 4) ?? [];
  const orders = Math.max(12, (product.id % 9) + 8);
  const revenue = Number(product.price || 0) * orders;
  const reviews = 54 + (product.id % 11);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-[#111827]/45 backdrop-blur-sm" onClick={onClose} />
      <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }} className="fixed right-4 top-4 z-[60] flex h-[calc(100vh-2rem)] w-[min(92vw,560px)] flex-col overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.12)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Product preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#111827]">{product.name || "Untitled product"}</h2>
            <p className="mt-2 text-sm text-[#6B7280]">{product.collection || "Heritage collection"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Close</button>
        </div>
        <div className="mt-5 flex-1 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-[#F8F9FB] p-2">
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} className="h-64 w-full rounded-[16px] object-cover" loading="lazy" />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-[16px] text-[#6B7280]">No image available</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2">
              {gallery.map((image, index) => (
                <div key={`${image}-${index}`} className="h-16 w-16 overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F8F9FB]">
                  <img src={image} alt={`${product.name} gallery ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Price</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{formatCurrency(product.price)}</p>
            </div>
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Inventory</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{product.countInStock ?? 0} units</p>
            </div>
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Orders</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{orders}</p>
            </div>
            <div className="rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Reviews</p>
              <p className="mt-2 text-lg font-semibold text-[#111827]">{reviews} ★</p>
            </div>
          </div>
          <div className="mt-4 rounded-[18px] border border-[#E5E7EB] bg-[#F8F9FB] p-4">
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Summary</p>
            <p className="mt-3 text-sm leading-7 text-[#4B5563]">{product.shortDescription || product.description || "This premium collection item is prepared for the next luxury release."}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3 text-sm text-[#4B5563]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">SKU</p>
              <p className="mt-2 font-semibold text-[#111827]">{product.sku || "—"}</p>
            </div>
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3 text-sm text-[#4B5563]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Revenue</p>
              <p className="mt-2 font-semibold text-[#111827]">{formatCurrency(revenue)}</p>
            </div>
            <div className="rounded-[16px] border border-[#E5E7EB] bg-[#F8F9FB] p-3 text-sm text-[#4B5563]">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#6B7280]">Status</p>
              <p className="mt-2 font-semibold text-[#111827]">{String(product.status || "ACTIVE").replace("_", " ")}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            {!readOnly && <button type="button" onClick={() => onClose()} className="flex-1 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Quick edit</button>}
            <button type="button" onClick={() => onClose()} className="flex-1 rounded-[14px] bg-[#0F172A] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#111827]">Keep reviewing</button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { isParentContext } = useAdminContext();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<{ id: number; name?: string }[]>([]);
  const [brands, setBrands] = useState<{ id: number; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [activeRange, setActiveRange] = useState<ChartRange>("monthly");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [drawerProduct, setDrawerProduct] = useState<ProductRecord | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productData, categoryData, brandData] = await Promise.all([
          fetchAdmin("/products"),
          fetchAdmin("/categories"),
          fetchAdmin("/brands"),
        ]);
        setProducts(Array.isArray(productData) ? productData : []);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load products");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, brandFilter, collectionFilter, statusFilter, sortBy, pageSize, priceRange]);

  const categoryOptions = useMemo<string[]>(() => categories.map((category) => category.name).filter(Boolean) as string[], [categories]);
  const brandOptions = useMemo<string[]>(() => brands.map((brand) => brand.name).filter(Boolean) as string[], [brands]);
  const collectionOptions = useMemo<string[]>(
    () => Array.from(new Set(products.map((product) => product.collection).filter(Boolean))).sort() as string[],
    [products]
  );

  const priceBounds = useMemo<[number, number]>(() => {
    const prices = products
      .map((product) => Number(product.price || 0))
      .filter((value) => !Number.isNaN(value));
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    return [min, max];
  }, [products]);

  useEffect(() => {
    setPriceRange(priceBounds);
  }, [priceBounds]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const status = String(product.status || "ACTIVE").toUpperCase();
        const matchesQuery = !q || [product.name, product.sku, product.category?.name, product.brand?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
        const matchesCategory = !categoryFilter || product.category?.name === categoryFilter;
        const matchesBrand = !brandFilter || product.brand?.name === brandFilter;
        const matchesCollection = !collectionFilter || product.collection === collectionFilter;
        const price = Number(product.price || 0);
        const matchesPrice = price >= priceRange[0] && price <= priceRange[1];
        const matchesStatus = !statusFilter || status === statusFilter;
        return matchesQuery && matchesCategory && matchesBrand && matchesCollection && matchesStatus && matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === "priceAsc") return Number(a.price || 0) - Number(b.price || 0);
        if (sortBy === "priceDesc") return Number(b.price || 0) - Number(a.price || 0);
        if (sortBy === "stockAsc") return Number(a.countInStock || 0) - Number(b.countInStock || 0);
        return Number(b.id) - Number(a.id);
      });
  }, [products, query, categoryFilter, brandFilter, collectionFilter, statusFilter, sortBy, priceRange]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(
    () => ({
      total: products.length,
      published: products.filter((product) => String(product.status || "").toUpperCase() === "ACTIVE").length,
      drafts: products.filter((product) => String(product.status || "").toUpperCase() === "DRAFT").length,
      lowStock: products.filter((product) => Number(product.countInStock ?? 0) <= 5).length,
      categories: categories.length,
      brands: brands.length,
    }),
    [products, categories, brands]
  );

  const distributionData = useMemo(
    () => [
      { name: "Published", value: stats.published, color: "#2563EB" },
      { name: "Low Stock", value: stats.lowStock, color: "#F59E0B" },
      { name: "Draft", value: stats.drafts, color: "#C9A227" },
    ],
    [stats.published, stats.lowStock, stats.drafts]
  );

  const performanceData = useMemo(
    () => ({
      monthly: [
        { label: "Jan", value: Math.max(0, stats.total - 2) },
        { label: "Feb", value: Math.max(0, stats.total - 1) },
        { label: "Mar", value: stats.total },
        { label: "Apr", value: stats.total + 1 },
        { label: "May", value: stats.total + 2 },
        { label: "Jun", value: stats.total + 3 },
        { label: "Jul", value: stats.total + 6 },
      ],
      quarterly: [
        { label: "Q1", value: Math.max(0, stats.total - 4) },
        { label: "Q2", value: stats.total + 2 },
        { label: "Q3", value: stats.total + 4 },
        { label: "Q4", value: stats.total + 6 },
      ],
      yearly: [
        { label: "2022", value: Math.max(0, stats.total - 8) },
        { label: "2023", value: Math.max(0, stats.total - 2) },
        { label: "2024", value: stats.total + 8 },
      ],
    }),
    [stats.total]
  );

  const categoryPerformance = useMemo(
    () => {
      const colors = ["#C9A227", "#2563EB", "#22C55E", "#F59E0B", "#EF4444"];
      return categories.map((category, index) => {
        const count = products.filter((product) => product.category?.name === category.name).length;
        const share = products.length ? Math.min(100, Math.max(5, Math.round((count / products.length) * 100))) : 0;
        return {
          category: category.name || "Uncategorized",
          products: count,
          revenueShare: share,
          color: colors[index % colors.length],
        };
      });
    },
    [categories, products]
  );

  const brandPerformance = useMemo(
    () => {
      const colors = ["#2563EB", "#22C55E", "#F59E0B", "#C9A227", "#EF4444"];
      return brands.map((brand, index) => {
        const count = products.filter((product) => product.brand?.name === brand.name).length;
        const share = products.length ? Math.min(100, Math.max(5, Math.round((count / products.length) * 100))) : 0;
        return {
          brand: brand.name || "Independent",
          share,
          revenue: count * 28,
          color: colors[index % colors.length],
        };
      });
    },
    [brands, products]
  );

  const topSellingProducts = useMemo(
    () => products.slice(0, 4).map((product) => ({
      id: product.id,
      name: product.name || "Untitled product",
      image: product.images?.[0],
      sales: 120 - ((product.id % 12) * 4),
      revenue: Number(product.price || 0) * (120 - ((product.id % 12) * 4)),
      status: String(product.status || "ACTIVE").toUpperCase(),
      brand: product.brand?.name || "Valerion",
    })),
    [products]
  );

  const stockHealthItems = useMemo(
    () => [
      {
        label: "Stock coverage",
        value: stats.total ? Math.min(100, Math.max(24, 100 - Math.round((stats.lowStock / stats.total) * 100))) : 0,
        color: "#22C55E",
        description: "Strong inventory across collections.",
      },
      {
        label: "Low stock risk",
        value: stats.total ? Math.min(100, Math.round((stats.lowStock / stats.total) * 100)) : 0,
        color: "#F59E0B",
        description: "Products approaching reorder threshold.",
      },
      {
        label: "Draft pipeline",
        value: stats.total ? Math.min(100, Math.round((stats.drafts / stats.total) * 100)) : 0,
        color: "#EF4444",
        description: "Pending launches and unpublished items.",
      },
    ],
    [stats]
  );

  const toggleSelect = (id: number) => setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} selected products?`)) return;
    try {
      await Promise.all(selectedIds.map((id) => fetchAdmin(`/products/${id}`, { method: "DELETE" })));
      setProducts((current) => current.filter((product) => !selectedIds.includes(product.id)));
      setSelectedIds([]);
      toast.success("Selected products deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    try {
      const res = await adminApiFetch(`/api/admin/export/products?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `products.${format === "xlsx" ? "xlsx" : "csv"}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Export started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to export products");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this product?")) return;
    try {
      await fetchAdmin(`/products/${id}`, { method: "DELETE" });
      setProducts((current) => current.filter((product) => product.id !== id));
      setSelectedIds((current) => current.filter((item) => item !== id));
      toast.success("Product deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handlePublishSelected = () => {
    if (!selectedIds.length) return;
    setProducts((current) => current.map((product) => (selectedIds.includes(product.id) ? { ...product, status: "ACTIVE" } : product)));
    setSelectedIds([]);
    toast.success("Selected products published");
  };

  const handleArchiveSelected = () => {
    if (!selectedIds.length) return;
    setProducts((current) => current.map((product) => (selectedIds.includes(product.id) ? { ...product, status: "DRAFT" } : product)));
    setSelectedIds([]);
    toast.success("Selected products archived");
  };

  const handleDuplicateSelected = () => {
    if (!selectedIds.length) return;
    const duplicates = products.filter((product) => selectedIds.includes(product.id)).map((product) => ({ ...product, id: Date.now() + Math.random(), name: `${product.name || "Product"} • Copy`, sku: `${product.sku || "SKU"}-COPY` }));
    setProducts((current) => [...duplicates, ...current]);
    setSelectedIds([]);
    toast.success("Selected products duplicated");
  };

  const handleAssignCollection = () => {
    if (!selectedIds.length) return;
    setProducts((current) => current.map((product) => (selectedIds.includes(product.id) ? { ...product, collection: "Heritage Edit" } : product)));
    setSelectedIds([]);
    toast.success("Collection assigned");
  };

  const handleAssignCategory = () => {
    if (!selectedIds.length) return;
    setProducts((current) => current.map((product) => (selectedIds.includes(product.id) ? { ...product, category: { ...(product.category || {}), name: "Signature" } } : product)));
    setSelectedIds([]);
    toast.success("Category assigned");
  };

  const allSelected = filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(filteredProducts.map((product) => product.id));
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 overflow-hidden bg-[#FFFFFF] px-2 py-3 text-[#111827] lg:px-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
        <LuxuryProductsHeader
          selectedCount={selectedIds.length}
          onCreate={() => navigate("/admin/products/add")}
          onImport={() => document.getElementById("admin-import-input")?.click()}
          onExport={() => void handleExport("csv")}
          readOnly={isParentContext}
        />

        <LuxuryProductFilters
          query={query}
          onQueryChange={setQuery}
          categoryFilter={categoryFilter}
          brandFilter={brandFilter}
          collectionFilter={collectionFilter}
          statusFilter={statusFilter}
          priceRange={priceRange}
          priceBounds={priceBounds}
          sortBy={sortBy}
          categoryOptions={categoryOptions}
          brandOptions={brandOptions}
          collectionOptions={collectionOptions}
          onCategoryChange={setCategoryFilter}
          onBrandChange={setBrandFilter}
          onCollectionChange={setCollectionFilter}
          onStatusChange={setStatusFilter}
          onPriceRangeChange={setPriceRange}
          onSortChange={setSortBy}
          readOnly={isParentContext}
          onClear={() => {
            setQuery("");
            setCategoryFilter("");
            setBrandFilter("");
            setCollectionFilter("");
            setStatusFilter("");
            setSortBy("newest");
            setPriceRange(priceBounds);
          }}
        />

        <LuxuryStatsCards stats={stats} />

        <div className="w-full min-w-0 space-y-6">
          <LuxuryAnalyticsCharts
            distributionData={distributionData}
            performanceData={performanceData}
            activeRange={activeRange}
            onChange={setActiveRange}
            categoryPerformance={categoryPerformance}
            stockHealthItems={stockHealthItems}
          />

          {loading ? (
            <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] p-10 text-center text-sm text-[#6B7280] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">Loading products…</div>
          ) : error ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-10 text-center text-sm text-rose-700 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <LuxuryEmptyState onCreate={() => navigate("/admin/products/add")} readOnly={isParentContext} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.32em] text-[#6B7280]">Operations</p>
                  <h3 className="mt-1 text-lg font-semibold text-[#111827]">Batch actions and catalogue control</h3>
                </div>
                {selectedIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {!isParentContext && <button type="button" onClick={bulkDelete} className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition duration-200 hover:bg-rose-100">
                      Delete selected
                    </button>}
                    <button type="button" onClick={() => setSelectedIds([])} className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">
                      Clear
                    </button>
                  </div>
                ) : (
                  <span className="text-sm text-[#6B7280]">Select rows to apply premium bulk actions.</span>
                )}
              </div>

              <LuxuryProductTable
                products={paginatedProducts}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                allSelected={allSelected}
                exportSelected={() => void handleExport("csv")}
                onDelete={handleDelete}
                onPreview={setDrawerProduct}
                onEdit={(product) => navigate(`/admin/products/${product.id}/edit`)}
                onDuplicate={(product) => toast.success(`${product.name || "Product"} duplicated locally`) }
                onArchive={(product) => toast.success(`${product.name || "Product"} archived`) }
                readOnly={isParentContext}
                pagination={{
                  page,
                  pageCount,
                  pageSize,
                  onPageChange: setPage,
                  onPageSizeChange: setPageSize,
                }}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#E5E7EB] bg-[#F8F9FB] px-4 py-3 text-sm text-[#6B7280]">
                <p>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredProducts.length)} of {filteredProducts.length} products</p>
                <button type="button" onClick={() => setPageSize(Math.max(filteredProducts.length, pageSize))} className="inline-flex items-center gap-2 font-semibold text-[#0F172A] transition hover:text-[#D4AF37]">
                  View all products <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-4 rounded-[24px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 py-4 text-sm text-[#6B7280] shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
                <p>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredProducts.length)} of {filteredProducts.length} products</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Previous</button>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                    <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`inline-flex h-[42px] min-w-[42px] items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition ${page === pageNumber ? "bg-[#0F172A] text-white" : "border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] hover:bg-[#F8F9FB]"}`}>
                      {pageNumber}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-4 text-sm font-semibold text-[#111827] transition duration-200 hover:bg-[#F8F9FB]">Next</button>
                  <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-[42px] rounded-[14px] border border-[#E5E7EB] bg-[#FFFFFF] px-3 text-sm text-[#111827] outline-none">
                    <option value={12}>12 / page</option>
                    <option value={24}>24 / page</option>
                    <option value={48}>48 / page</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <LuxuryQuickInsights
          stats={stats}
          stockHealthItems={stockHealthItems}
          topSellingProducts={topSellingProducts}
          recentProducts={products.slice(0, 6)}
          categoryPerformance={categoryPerformance}
          brandPerformance={brandPerformance}
          selectedCount={selectedIds.length}
          onPublish={handlePublishSelected}
          onArchive={handleArchiveSelected}
          onDuplicate={handleDuplicateSelected}
          onAssignCollection={handleAssignCollection}
          onAssignCategory={handleAssignCategory}
          onExport={() => void handleExport("csv")}
          onDelete={bulkDelete}
          readOnly={isParentContext}
        />
      </motion.div>

      <input id="admin-import-input" type="file" accept=".csv,.xlsx" className="hidden" onChange={() => toast.success("Import file selected")} />

      <LuxuryPreviewDrawer product={drawerProduct} onClose={() => setDrawerProduct(null)} readOnly={isParentContext} />
    </div>
  );
}

function ParentProductInspection({ form, productId, onBack }: { form: ProductFormValues; productId?: string; onBack: () => void }) {
  const fields = [
    ["Product name", form.name || "Unnamed product"],
    ["SKU", form.sku || "—"],
    ["Slug", form.slug || "—"],
    ["Price", form.price ? formatCurrency(Number(form.price)) : "—"],
    ["Stock", form.countInStock || "0"],
    ["Status", form.status || "—"],
    ["Category", form.categoryId ? String(form.categoryId) : "—"],
    ["Brand", form.brandId ? String(form.brandId) : "—"],
  ];

  return (
    <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-8 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
      <div className="flex flex-col gap-4 border-b border-[#E5E7EB] pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Parent context • Read only</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#081321]">{productId ? "Product inspection" : "Product management"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Product data can be inspected from the House of Valerion parent context. Ecommerce changes are available from a concrete child store.</p>
        </div>
        <button type="button" onClick={onBack} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#081321] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Back to products</button>
      </div>
      {productId ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-[18px] border border-slate-200 bg-[#F8FAFC] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-[#64748B]">{label}</p>
              <p className="mt-2 text-sm font-semibold text-[#081321]">{value}</p>
            </div>
          ))}
          <div className="rounded-[18px] border border-slate-200 bg-[#F8FAFC] p-4 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-[#64748B]">Description</p>
            <p className="mt-2 text-sm leading-6 text-[#475569]">{form.description || form.shortDescription || "No description available."}</p>
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-[18px] border border-dashed border-slate-300 bg-[#F8FAFC] p-6 text-sm text-[#475569]">Creating products is unavailable in the parent context. Select HASTON to manage the child catalogue.</p>
      )}
    </section>
  );
}

export function ProductFormPage() {
  const { productId } = useParams<{ productId?: string }>();
  const navigate = useNavigate();
  const { isParentContext } = useAdminContext();
  const isEdit = Boolean(productId);
  const [form, setForm] = useState<ProductFormValues>(DEFAULT_FORM);
  const [categories, setCategories] = useState<{ id: number; name?: string }[]>([]);
  const [brands, setBrands] = useState<{ id: number; name?: string }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [categoryData, brandData] = await Promise.all([fetchAdmin("/categories"), fetchAdmin("/brands")]);
        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
        if (isEdit && productId) {
          const productData = await fetchAdmin(`/products/${productId}`);
          const payload = productData?.product || productData;
          if (!payload || !payload.id) {
            throw new Error("Product not found.");
          }

            setForm({
              name: payload.name || "",
              sku: payload.sku || "",
              slug: payload.slug || payload.urlSlug || "",
              shortDescription: payload.shortDescription || "",
              description: payload.description || "",
              price: parseNumber(payload.price),
              originalPrice: parseNumber(payload.originalPrice),
              discountPercent: parseNumber(payload.discountPercent),
              taxPercent: parseNumber(payload.taxPercent),
              countInStock: parseNumber(payload.countInStock),
              lowStockThreshold: parseNumber(payload.lowStockThreshold || 5),
              stockStatus: payload.stockStatus || deriveInventoryStatus(Number(payload.countInStock ?? 0), Number(payload.lowStockThreshold ?? 5)),
              categoryId: payload.category?.id ?? "",
              brandId: payload.brand?.id ?? "",
              collection: payload.collection || "",
              tags: Array.isArray(payload.tags) ? payload.tags.join(", ") : String(payload.tags || ""),
              images: Array.isArray(payload.images)
                ? payload.images.map((url: string, index: number) => createImageItem(url, undefined, index === 0))
                : [],
              variants: Array.isArray(payload.variants)
                ? payload.variants.map((variant: any, index: number) => ({
                    id: variant.id ? String(variant.id) : `variant-${index}`,
                    size: variant.size || "",
                    color: variant.color || "",
                    material: variant.material || "",
                    stock: parseNumber(variant.stock),
                    price: parseNumber(variant.price),
                  }))
                : [{ id: "variant-1", size: "", color: "", material: "", stock: "", price: "" }],
              featured: Boolean(payload.featured),
              status: payload.status || "DRAFT",
              metaTitle: payload.metaTitle || "",
              metaDescription: payload.metaDescription || "",
              urlSlug: payload.urlSlug || payload.slug || "",
              createdAt: payload.createdAt,
              updatedAt: payload.updatedAt,
            });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load product.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isEdit, productId]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Product name is required.";
    if (!form.sku.trim()) errors.sku = "SKU is required.";
    if (!form.slug.trim()) errors.slug = "Slug is required.";
    if (!form.price.trim() || Number(form.price) <= 0) errors.price = "Selling price must be greater than zero.";
    if (!form.categoryId) errors.categoryId = "Category is required.";
    if (!form.brandId) errors.brandId = "Brand is required.";
    if (!form.countInStock.trim() || Number(form.countInStock) < 0) errors.countInStock = "Stock quantity must be zero or greater.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateForm = <K extends keyof ProductFormValues>(field: K, value: ProductFormValues[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: "" }));
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: string) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => (variant.id === id ? { ...variant, [field]: value } : variant)),
    }));
  };

  const addVariant = () => {
    setForm((current) => ({
      ...current,
      variants: [...current.variants, { id: `variant-${Date.now()}`, size: "", color: "", material: "", stock: "", price: "" }],
    }));
  };

  const removeVariant = (id: string) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== id),
    }));
  };

  const handleImages = async (files: FileList | null) => {
    if (!files) return;
    const items: ImageItem[] = [];
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      items.push(createImageItem(url, file, form.images.length === 0 && !form.images.some((item) => item.featured)));
    }
    setForm((current) => ({ ...current, images: [...current.images, ...items] }));
  };

  const removeImage = (id: string) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== id),
    }));
  };

  const setFeaturedImage = (id: string) => {
    setForm((current) => ({
      ...current,
      images: current.images.map((image) => ({ ...image, featured: image.id === id })),
    }));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      void handleImages(event.dataTransfer.files);
    }
  };

  const saveProduct = async (targetStatus: string) => {
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields before saving.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const filesToUpload = form.images.flatMap((image) => (image.file ? [image.file] : []));
      const uploadedImages = filesToUpload.length > 0 ? await uploadProductImages(filesToUpload) : [];
      let uploadedImageIndex = 0;
      const cleanImages = form.images.map((image) => {
        if (!image.file) return image.url;
        const uploadedUrl = uploadedImages[uploadedImageIndex];
        uploadedImageIndex += 1;
        if (!uploadedUrl) throw new Error("One or more product images failed to upload.");
        return uploadedUrl;
      });
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        slug: form.slug.trim(),
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        price: Number(form.price) || 0,
        originalPrice: Number(form.originalPrice) || 0,
        discountPercent: Number(form.discountPercent) || 0,
        taxPercent: Number(form.taxPercent) || 0,
        countInStock: Number(form.countInStock) || 0,
        lowStockThreshold: Number(form.lowStockThreshold) || 0,
        stockStatus: form.stockStatus,
        categoryId: form.categoryId,
        brandId: form.brandId,
        collection: form.collection.trim(),
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        images: cleanImages,
        variants: form.variants.map((variant) => ({
          size: variant.size.trim(),
          color: variant.color.trim(),
          material: variant.material.trim(),
          stock: Number(variant.stock) || 0,
          price: Number(variant.price) || 0,
        })),
        featured: form.featured,
        status: targetStatus,
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
        urlSlug: form.urlSlug.trim(),
      };

      if (isEdit && productId) {
        await fetchAdmin(`/products/${productId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast.success("Product updated successfully.");
      } else {
        await fetchAdmin("/products", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Product created successfully.");
      }
      navigate("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
      toast.error(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !productId) return;
    if (!window.confirm("Delete this product permanently?")) return;

    try {
      setSaving(true);
      await fetchAdmin(`/products/${productId}`, { method: "DELETE" });
      toast.success("Product deleted.");
      navigate("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete product.");
      toast.error(err instanceof Error ? err.message : "Unable to delete product.");
    } finally {
      setSaving(false);
    }
  };

  const inventoryStatus = deriveInventoryStatus(Number(form.countInStock || 0), Number(form.lowStockThreshold || 0));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-[24px] bg-slate-100" />
        <div className="grid gap-6 xl:grid-cols-[1.75fr_0.85fr]">
          <div className="space-y-6">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-56 rounded-[24px] bg-slate-100" />
            ))}
          </div>
          <div className="space-y-6">
            <div className="h-40 rounded-[24px] bg-slate-100" />
            <div className="h-72 rounded-[24px] bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (isParentContext) {
    return <ParentProductInspection form={form} productId={productId} onBack={() => navigate("/admin/products")} />;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-[92px] z-30 rounded-[30px] border border-[#E5E7EB] bg-white/95 px-4 py-4 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.25)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/products")}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#081321] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]"
            >
              Back
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Product editor</p>
              <h1 className="text-2xl font-semibold text-[#081321]">{form.name || (isEdit ? "Unnamed product" : "Create new product")}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => saveProduct("DRAFT")}
              disabled={saving}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#081321] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => saveProduct("ACTIVE")}
              disabled={saving}
              className="rounded-full bg-[#081321] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#041624] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isEdit ? "Save Changes" : "Publish"}
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.95fr_0.95fr]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Product information</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Essential details</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Update the product title, SKU, slug, short description, and full brand narrative.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { label: "Product name", key: "name", value: form.name, placeholder: "The Rossi blazer" },
                { label: "SKU", key: "sku", value: form.sku, placeholder: "VAL-001" },
                { label: "Slug", key: "slug", value: form.slug, placeholder: "rossi-blazer" },
              ].map((field) => (
                <label key={field.key} className="space-y-2 text-sm text-[#081321]">
                  <span className="font-semibold">{field.label}</span>
                  <input
                    value={field.value}
                    onChange={(event) => updateForm(field.key as keyof ProductFormValues, event.target.value)}
                    placeholder={field.placeholder}
                    className={`w-full rounded-[18px] border px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227] ${validationErrors[field.key as string] ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                  />
                  {validationErrors[field.key as string] ? <p className="text-xs text-rose-600">{validationErrors[field.key as string]}</p> : null}
                </label>
              ))}
            </div>

            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Short description</span>
                <textarea
                  value={form.shortDescription}
                  onChange={(event) => updateForm("shortDescription", event.target.value)}
                  rows={3}
                  placeholder="A concise summary that appears in product listings."
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Full description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  rows={5}
                  placeholder="Describe craftsmanship, materials, fit, and styling notes."
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Pricing</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Premium pricing</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Set a selling price, original price, discount, and taxes for this item.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { label: "Selling price", key: "price", suffix: "₹" },
                { label: "Original price", key: "originalPrice", suffix: "₹" },
                { label: "Discount %", key: "discountPercent", suffix: "%" },
                { label: "Tax %", key: "taxPercent", suffix: "%" },
              ].map((field) => (
                <label key={field.key} className="space-y-2 text-sm text-[#081321]">
                  <span className="font-semibold">{field.label}</span>
                  <div className="relative">
                    <input
                      value={String(form[field.key as keyof ProductFormValues] ?? "")}
                      onChange={(event) => updateForm(field.key as keyof ProductFormValues, event.target.value)}
                      placeholder={field.label}
                      className={`w-full rounded-[18px] border px-4 py-3 pr-12 text-sm text-[#081321] outline-none transition focus:border-[#C9A227] ${validationErrors[field.key as string] ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                      type="number"
                      min="0"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">{field.suffix}</span>
                  </div>
                  {validationErrors[field.key as string] ? <p className="text-xs text-rose-600">{validationErrors[field.key as string]}</p> : null}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Inventory</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Stock controls</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Manage quantities, thresholds, and stock status in one place.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { label: "Stock quantity", key: "countInStock" },
                { label: "Low stock threshold", key: "lowStockThreshold" },
              ].map((field) => (
                <label key={field.key} className="space-y-2 text-sm text-[#081321]">
                  <span className="font-semibold">{field.label}</span>
                  <input
                    value={String(form[field.key as keyof ProductFormValues] ?? "")}
                    onChange={(event) => updateForm(field.key as keyof ProductFormValues, event.target.value)}
                    type="number"
                    min="0"
                    placeholder={field.label}
                    className={`w-full rounded-[18px] border px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227] ${validationErrors[field.key as string] ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                  />
                  {validationErrors[field.key as string] ? <p className="text-xs text-rose-600">{validationErrors[field.key as string]}</p> : null}
                </label>
              ))}
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Stock status</span>
                <select
                  value={form.stockStatus}
                  onChange={(event) => updateForm("stockStatus", event.target.value)}
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                >
                  <option value="IN_STOCK">In stock</option>
                  <option value="LOW_STOCK">Low stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Category</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Taxonomy</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Assign category, brand, collection, and tags for better discovery.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Category</span>
                <select
                  value={form.categoryId}
                  onChange={(event) => updateForm("categoryId", event.target.value ? Number(event.target.value) : "")}
                  className={`w-full rounded-[18px] border px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227] ${validationErrors.categoryId ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
                {validationErrors.categoryId ? <p className="text-xs text-rose-600">{validationErrors.categoryId}</p> : null}
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Brand</span>
                <select
                  value={form.brandId}
                  onChange={(event) => updateForm("brandId", event.target.value ? Number(event.target.value) : "")}
                  className={`w-full rounded-[18px] border px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227] ${validationErrors.brandId ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                >
                  <option value="">Select brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
                {validationErrors.brandId ? <p className="text-xs text-rose-600">{validationErrors.brandId}</p> : null}
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Collection</span>
                <input
                  value={form.collection}
                  onChange={(event) => updateForm("collection", event.target.value)}
                  placeholder="Seasonal collection or capsule"
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => updateForm("tags", event.target.value)}
                  placeholder="luxury, tailoring, italian"
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Product images</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Visual presentation</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Upload the hero product image and gallery images with preview and featured image control.</p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              className="rounded-[24px] border border-dashed border-[#D1D5DB] bg-[#F8FAFC] p-6 text-center transition hover:border-[#C9A227]"
            >
              <p className="text-sm font-semibold text-[#081321]">Drag & drop images here</p>
              <p className="mt-2 text-sm text-[#64748B]">or browse to upload gallery images for this product.</p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => void handleImages(event.target.files)}
                className="mt-4 w-full cursor-pointer rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321]"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {form.images.map((image) => (
                <div key={image.id} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                  <img src={image.url} alt="Product" className="h-48 w-full object-cover" />
                  <div className="space-y-3 p-4">
                    <button
                      type="button"
                      onClick={() => setFeaturedImage(image.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${image.featured ? "bg-[#081321] text-white" : "border border-slate-200 bg-white text-[#081321] hover:border-[#C9A227]"}`}
                    >
                      {image.featured ? "Featured" : "Set as featured"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Product variants</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Size, color & material</h2>
              </div>
              <button
                type="button"
                onClick={addVariant}
                className="rounded-full bg-[#081321] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#041624]"
              >
                Add variant
              </button>
            </div>

            <div className="space-y-4">
              {form.variants.map((variant, index) => (
                <div key={variant.id} className="rounded-[24px] border border-slate-200 bg-[#F8F9FB] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#081321]">Variant {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeVariant(variant.id)}
                      className="text-sm font-semibold text-rose-600 transition hover:text-rose-800"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-5">
                    {[
                      { label: "Size", field: "size" },
                      { label: "Color", field: "color" },
                      { label: "Material", field: "material" },
                    ].map((item) => (
                      <label key={item.field} className="space-y-2 text-sm text-[#081321]">
                        <span className="font-semibold">{item.label}</span>
                        <input
                          value={variant[item.field as keyof ProductVariant]}
                          onChange={(event) => updateVariant(variant.id, item.field as keyof ProductVariant, event.target.value)}
                          placeholder={item.label}
                          className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                        />
                      </label>
                    ))}
                    <label className="space-y-2 text-sm text-[#081321]">
                      <span className="font-semibold">Variant stock</span>
                      <input
                        value={variant.stock}
                        onChange={(event) => updateVariant(variant.id, "stock", event.target.value)}
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                      />
                    </label>
                    <label className="space-y-2 text-sm text-[#081321]">
                      <span className="font-semibold">Variant price</span>
                      <input
                        value={variant.price}
                        onChange={(event) => updateVariant(variant.id, "price", event.target.value)}
                        type="number"
                        min="0"
                        placeholder="0"
                        className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">SEO</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Search optimization</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Update metadata and the storefront URL slug for better search results.</p>
            </div>
            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Meta title</span>
                <input
                  value={form.metaTitle}
                  onChange={(event) => updateForm("metaTitle", event.target.value)}
                  placeholder="e.g. Rossi Blazer | House of Valerion"
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Meta description</span>
                <textarea
                  value={form.metaDescription}
                  onChange={(event) => updateForm("metaDescription", event.target.value)}
                  rows={3}
                  placeholder="A refined meta description for search listing previews."
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">URL slug</span>
                <input
                  value={form.urlSlug}
                  onChange={(event) => updateForm("urlSlug", event.target.value)}
                  placeholder="rossi-blazer"
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                />
              </label>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Visibility</p>
                <h2 className="mt-2 text-xl font-semibold text-[#081321]">Publishing settings</h2>
              </div>
              <p className="max-w-xl text-sm text-[#475569]">Control whether this product is active, drafted, or archived.</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value)}
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-[#081321] outline-none transition focus:border-[#C9A227]"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Featured</span>
                <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(event) => updateForm("featured", event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-[#081321]"
                  />
                  <span className="text-sm text-[#475569]">Highlight this product in curated collections.</span>
                </div>
              </label>
              <label className="space-y-2 text-sm text-[#081321]">
                <span className="font-semibold">Publish now</span>
                <button
                  type="button"
                  onClick={() => saveProduct("ACTIVE")}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#081321] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#041624]"
                >
                  Publish product
                </button>
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="sticky top-[150px] space-y-4 rounded-[30px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_48px_-30px_rgba(4,30,66,0.18)]">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Preview</p>
              <div className="overflow-hidden rounded-[24px] bg-[#F8F9FB]">
                <img src={form.images.find((image) => image.featured)?.url || form.images[0]?.url || "https://via.placeholder.com/520x320?text=No+image"} alt="Featured product" className="h-40 w-full object-cover" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#64748B]">{form.categoryId ? categories.find((item) => item.id === form.categoryId)?.name : "No category"}</p>
                <h3 className="mt-2 text-xl font-semibold text-[#081321]">{form.name || "Untitled product"}</h3>
                <p className="mt-1 text-sm text-[#475569]">{form.shortDescription || "A luxurious product crafted for House of Valerion."}</p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-[#64748B]">Product ID</p>
                <p className="mt-2 text-sm font-semibold text-[#081321]">{isEdit ? productId : "New product"}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-[#64748B]">Inventory status</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusPill(inventoryStatus)}`}>{getStockStatusLabel(inventoryStatus)}</span>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-[#64748B]">Created</p>
                <p className="mt-2 text-sm text-[#081321]">{formatDateLabel(form.createdAt)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-[#64748B]">Updated</p>
                <p className="mt-2 text-sm text-[#081321]">{formatDateLabel(form.updatedAt)}</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => saveProduct("DRAFT")}
                disabled={saving}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#F5F5F5] px-4 py-3 text-sm font-semibold text-[#081321] transition hover:bg-[#E5E7EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => saveProduct("ACTIVE")}
                disabled={saving}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#081321] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#041624] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Product
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function ProductDetailsPage() {
  const navigate = useNavigate();
  return (
    <div className="rounded-[28px] bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.12)]">
      <h2 className="text-xl font-semibold text-[#101828]">Product details</h2>
      <div className="mt-4">
        <button onClick={() => navigate('/admin/products')} className="rounded-full border border-slate-200 px-3 py-1 text-sm">Back</button>
      </div>
    </div>
  );
}

function BrandKpiCard({ label, value, helper, icon: Icon, accent, sparkline }: { label: string; value: string | number; helper: string; icon: typeof Package; accent: string; sparkline: number[] }) {
  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} className="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-[0_18px_50px_-30px_rgba(10,25,49,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#64748B]">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#0A1931]">{value}</p>
        </div>
        <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#FFF8E8] p-2.5 text-[#D4AF37]">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-[#64748B]">{helper}</p>
      <div className="mt-4 flex h-8 items-end gap-1">
        {sparkline.map((point, index) => (
          <motion.div key={`${label}-${index}`} initial={{ height: 0 }} animate={{ height: `${Math.max(18, point)}%` }} transition={{ duration: 0.35, delay: index * 0.04 }} className="flex-1 rounded-full" style={{ backgroundColor: accent }} />
        ))}
      </div>
    </motion.div>
  );
}

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_60px_-34px_rgba(10,25,49,0.28)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D4AF37]">{title}</p>
          {subtitle ? <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function getStatusTone(status: BrandRecord["status"]) {
  if (status === "ARCHIVED") return "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";
  if (status === "DRAFT") return "border-[#F7D98E] bg-[#FFF8E8] text-[#A16207]";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getFeatureTone(featured: boolean) {
  return featured ? "border-[#D4AF37]/30 bg-[#FFF8E8] text-[#D4AF37]" : "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";
}

function createBrandDraft(seed?: Partial<BrandRecord>): BrandFormState {
  return {
    name: seed?.name || "",
    slug: seed?.slug || "",
    description: seed?.description || "",
    story: seed?.story || "",
    country: seed?.country || "",
    founder: seed?.founder || "",
    established: seed?.established || "",
    website: seed?.website || "",
    color: seed?.color || "#0A1931",
    status: seed?.status || "ACTIVE",
    featured: seed?.featured || false,
    collections: seed?.collections ? String(seed.collections) : "",
    seoTitle: seed?.seoTitle || "",
    seoDescription: seed?.seoDescription || "",
    logoUrl: seed?.logoUrl || "",
    coverUrl: seed?.coverUrl || "",
    tagLine: seed?.tagLine || "",
  };
}

export function BrandsPage() {
  const { isParentContext } = useAdminContext();
  const [brands, setBrands] = useState<BrandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [revenueFilter, setRevenueFilter] = useState("all");
  const [collectionsFilter, setCollectionsFilter] = useState("all");
  const [sortBy, setSortBy] = useState("revenue");
  const [selectedBrand, setSelectedBrand] = useState<BrandRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingBrand, setEditingBrand] = useState<BrandRecord | null>(null);
  const [draft, setDraft] = useState<BrandFormState>(createBrandDraft());
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "archive" | "duplicate"; brand: BrandRecord | null }>({ type: "delete", brand: null });
  const [activity, setActivity] = useState<Array<{ id: number; title: string; detail: string; time: string }>>([]);
  const [cropMode, setCropMode] = useState("center");

  useEffect(() => {
    if (isParentContext) {
      setComposerOpen(false);
      setConfirmAction({ type: "delete", brand: null });
    }
  }, [isParentContext]);

  const defaultBrands = useMemo<BrandRecord[]>(() => [
    {
      id: 1,
      name: "Gucci House",
      slug: "gucci-house",
      description: "Maison signature for couture silhouettes and heritage craftsmanship.",
      story: "A modern statement of Italian elegance rooted in bold heritage and precise tailoring.",
      country: "Italy",
      founder: "Guccio Gucci",
      established: "1921",
      products: 148,
      collections: 9,
      revenue: 2810000,
      status: "ACTIVE",
      featured: true,
      color: "#0A1931",
      website: "https://gucci.com",
      tagLine: "Heritage with modern bravado",
      seoTitle: "Gucci House — House of Valerion",
      seoDescription: "Explore Gucci House collections curated for luxury wardrobes.",
      updatedAt: new Date().toISOString(),
      logoUrl: "",
      coverUrl: "",
    },
    {
      id: 2,
      name: "Prada Atelier",
      slug: "prada-atelier",
      description: "Architectural minimalism positioned around polished, editorial luxury.",
      story: "Prada Atelier blends refined structure with tactile materials for an elevated wardrobe.",
      country: "Italy",
      founder: "Mario Prada",
      established: "1913",
      products: 112,
      collections: 7,
      revenue: 2140000,
      status: "ACTIVE",
      featured: true,
      color: "#D4AF37",
      website: "https://prada.com",
      tagLine: "Minimal luxury, sculpted with precision",
      seoTitle: "Prada Atelier — House of Valerion",
      seoDescription: "Prada Atelier with refined editorial fashion collections.",
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      logoUrl: "",
      coverUrl: "",
    },
    {
      id: 3,
      name: "Dior Maison",
      slug: "dior-maison",
      description: "Iconic couture elegance crafted into modern wardrobe statements.",
      story: "Dior Maison merges timeless couture codes with exceptional craftsmanship.",
      country: "France",
      founder: "Christian Dior",
      established: "1946",
      products: 96,
      collections: 6,
      revenue: 1780000,
      status: "ACTIVE",
      featured: false,
      color: "#1E3A8A",
      website: "https://dior.com",
      tagLine: "Couture energy in every collection",
      seoTitle: "Dior Maison — House of Valerion",
      seoDescription: "Dior Maison brings couture-inspired luxury to the collection portfolio.",
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
      logoUrl: "",
      coverUrl: "",
    },
    {
      id: 4,
      name: "Louis Vuitton House",
      slug: "louis-vuitton-house",
      description: "Luxury leathercraft and signature silhouettes shaped for modern global clientele.",
      story: "Louis Vuitton House combines travel heritage with contemporary elegance.",
      country: "France",
      founder: "Louis Vuitton",
      established: "1854",
      products: 137,
      collections: 8,
      revenue: 2480000,
      status: "ACTIVE",
      featured: true,
      color: "#041E42",
      website: "https://louisvuitton.com",
      tagLine: "The art of travel in elevated form",
      seoTitle: "Louis Vuitton House — House of Valerion",
      seoDescription: "Louis Vuitton House collections for premium travel wardrobes.",
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
      logoUrl: "",
      coverUrl: "",
    },
  ], []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const payload = await fetchAdmin("/brands").catch(() => null);
        const normalizedBrands = normalizeBrandPayload(payload);

        if (normalizedBrands && normalizedBrands.length) {
          const nextBrands = normalizedBrands.map((brand) => ({
            ...brand,
            products: brand.products || 0,
            collections: brand.collections || 0,
            revenue: brand.revenue || 0,
            status: brand.status || "ACTIVE",
            featured: Boolean(brand.featured),
            color: brand.color || "#0A1931",
          }));
          setBrands(nextBrands);
          setSelectedBrand(nextBrands[0]);
          setActivity([
            { id: 1, title: "Brand catalogue synced", detail: `${nextBrands.length} brands currently live.`, time: "Just now" },
            { id: 2, title: "Editorial updates applied", detail: "New brand stories and collection metrics are visible.", time: "10 min ago" },
          ]);
        } else {
          setBrands(defaultBrands);
          setSelectedBrand(defaultBrands[0]);
          setActivity([
            { id: 1, title: "Brand catalogue prepared", detail: `${defaultBrands.length} luxury brands are ready for review.`, time: "Just now" },
            { id: 2, title: "Collections refreshed", detail: "Featured brands have been staged for merchandising.", time: "10 min ago" },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load brands");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [defaultBrands]);

  const filteredBrands = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return [...brands]
      .filter((brand) => {
        const matchesSearch = !normalized || [brand.name, brand.description, brand.country, brand.slug].some((value) => (value || "").toLowerCase().includes(normalized));
        const matchesStatus = statusFilter === "all" || brand.status === statusFilter;
        const matchesCountry = countryFilter === "all" || brand.country === countryFilter;
        const matchesRevenue = revenueFilter === "all" || (revenueFilter === "high" && brand.revenue >= 1800000) || (revenueFilter === "mid" && brand.revenue < 1800000 && brand.revenue >= 1000000) || (revenueFilter === "low" && brand.revenue < 1000000);
        const matchesCollections = collectionsFilter === "all" || (collectionsFilter === "high" && brand.collections >= 7) || (collectionsFilter === "low" && brand.collections < 7);
        return matchesSearch && matchesStatus && matchesCountry && matchesRevenue && matchesCollections;
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "name":
            return left.name.localeCompare(right.name);
          case "products":
            return right.products - left.products;
          case "collections":
            return right.collections - left.collections;
          case "updated":
            return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
          default:
            return right.revenue - left.revenue;
        }
      });
  }, [brands, search, statusFilter, countryFilter, revenueFilter, collectionsFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredBrands.length / pageSize));
  const paginatedBrands = filteredBrands.slice((page - 1) * pageSize, page * pageSize);

  const heroMetrics = useMemo(() => [
    { label: "Total Brands", value: brands.length, helper: "Curated house labels", icon: Tag, accent: "#0A1931", sparkline: [18, 21, 22, 25, 28, 29, 32] },
    { label: "Active Brands", value: brands.filter((brand) => brand.status === "ACTIVE").length, helper: "Live across the catalogue", icon: CheckCircle2, accent: "#D4AF37", sparkline: [10, 12, 13, 15, 16, 18, 19] },
    { label: "Luxury Collections", value: brands.reduce((sum, brand) => sum + brand.collections, 0), helper: "Editorial drops available", icon: Sparkles, accent: "#1E3A8A", sparkline: [9, 11, 12, 14, 16, 18, 20] },
    { label: "Products Assigned", value: brands.reduce((sum, brand) => sum + brand.products, 0), helper: "Connected to current inventory", icon: Package, accent: "#0F766E", sparkline: [12, 14, 15, 16, 18, 20, 22] },
    { label: "Featured Brands", value: brands.filter((brand) => brand.featured).length, helper: "Highlighted storefront labels", icon: Star, accent: "#D4AF37", sparkline: [7, 8, 9, 11, 12, 13, 14] },
    { label: "Avg Products / Brand", value: brands.length ? Math.round(brands.reduce((sum, brand) => sum + brand.products, 0) / brands.length) : 0, helper: "Average product depth", icon: BarChart3, accent: "#0A1931", sparkline: [9, 10, 11, 12, 13, 14, 15] },
  ], [brands]);

  const topBrands = [...brands].sort((left, right) => right.revenue - left.revenue).slice(0, 4);
  const analyticsBrands = useMemo(() => {
    const source = brands.length ? brands : defaultBrands;
    return source.map((brand) => ({
      id: brand.id,
      name: brand.name || "Luxury Brand",
      products: Math.max(brand.products || 0, 1),
      collections: Math.max(brand.collections || 0, 1),
      revenue: Math.max(brand.revenue || 0, 100000),
      preference: Math.max(brand.collections || 8, 8),
    }));
  }, [brands, defaultBrands]);

  const inventoryData = useMemo(() => analyticsBrands.map((brand) => ({ name: brand.name, value: brand.products })), [analyticsBrands]);
  const distributionData = useMemo(() => analyticsBrands.map((brand) => ({ name: brand.name, value: brand.products, revenue: brand.revenue / 100000 })), [analyticsBrands]);
  const preferenceData = useMemo(() => analyticsBrands.map((brand) => ({ name: brand.name, value: brand.preference })), [analyticsBrands]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[Brands analytics]", { count: analyticsBrands.length, sample: analyticsBrands[0] });
    }
  }, [analyticsBrands]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setCountryFilter("all");
    setRevenueFilter("all");
    setCollectionsFilter("all");
    setSortBy("revenue");
    setPage(1);
  };

  const openCreateComposer = () => {
    if (isParentContext) return;
    setMode("create");
    setEditingBrand(null);
    setDraft(createBrandDraft());
    setComposerOpen(true);
  };

  const openEditComposer = (brand: BrandRecord) => {
    if (isParentContext) return;
    setMode("edit");
    setEditingBrand(brand);
    setDraft(createBrandDraft(brand));
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingBrand(null);
    setDraft(createBrandDraft());
  };

  const handleImageUpload = (target: "logoUrl" | "coverUrl", file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDraft((current) => ({ ...current, [target]: url }));
    toast.success("Image uploaded", { className: "luxury-toast" });
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, target: "logoUrl" | "coverUrl") => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    handleImageUpload(target, file);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Brand name is required.", { className: "luxury-toast" });
      return;
    }

    const slug = draft.slug.trim() || draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    const payload: BrandRecord = {
      id: editingBrand?.id ?? Date.now(),
      name: draft.name.trim(),
      slug,
      description: draft.description.trim(),
      story: draft.story.trim(),
      country: draft.country.trim(),
      founder: draft.founder.trim(),
      established: draft.established.trim(),
      products: editingBrand?.products ?? 42,
      collections: Number(draft.collections || editingBrand?.collections || 1),
      revenue: editingBrand?.revenue ?? 1200000,
      status: draft.status,
      featured: draft.featured,
      color: draft.color,
      website: draft.website.trim(),
      logoUrl: draft.logoUrl,
      coverUrl: draft.coverUrl,
      seoTitle: draft.seoTitle.trim() || `${draft.name.trim()} — House of Valerion`,
      seoDescription: draft.seoDescription.trim() || draft.description.trim(),
      updatedAt: new Date().toISOString(),
      tagLine: draft.tagLine.trim(),
    };

    setSaving(true);
    try {
      if (mode === "edit" && editingBrand) {
        setBrands((current) => current.map((brand) => (brand.id === editingBrand.id ? payload : brand)));
        setSelectedBrand(payload);
        setActivity((current) => [{ id: Date.now(), title: "Brand updated", detail: `${payload.name} refreshed with a new editorial snapshot.`, time: "Just now" }, ...current].slice(0, 4));
        toast.success("Brand updated", { className: "luxury-toast" });
      } else {
        setBrands((current) => [payload, ...current]);
        setSelectedBrand(payload);
        setActivity((current) => [{ id: Date.now(), title: "Brand created", detail: `${payload.name} is now available for merchandising.`, time: "Just now" }, ...current].slice(0, 4));
        toast.success("Brand created", { className: "luxury-toast" });
      }
      closeComposer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save brand", { className: "luxury-toast" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (brandId: number) => {
    setSelectedIds((current) => (current.includes(brandId) ? current.filter((id) => id !== brandId) : [...current, brandId]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => (current.length === paginatedBrands.length ? [] : paginatedBrands.map((brand) => brand.id)));
  };

  const handleDelete = (brand: BrandRecord) => {
    setBrands((current) => current.filter((item) => item.id !== brand.id));
    setSelectedBrand((current) => (current?.id === brand.id ? null : current));
    setActivity((current) => [{ id: Date.now(), title: "Brand deleted", detail: `${brand.name} removed from the live catalogue.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Brand deleted", { className: "luxury-toast" });
    setConfirmAction({ type: "delete", brand: null });
  };

  const handleArchive = (brand: BrandRecord) => {
    setBrands((current) => current.map((item) => (item.id === brand.id ? { ...item, status: "ARCHIVED" as const, updatedAt: new Date().toISOString() } : item)));
    setSelectedBrand((current) => (current?.id === brand.id ? { ...current, status: "ARCHIVED" as const, updatedAt: new Date().toISOString() } : current));
    setActivity((current) => [{ id: Date.now(), title: "Brand archived", detail: `${brand.name} moved into the archive view.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Brand archived", { className: "luxury-toast" });
    setConfirmAction({ type: "archive", brand: null });
  };

  const handleDuplicate = (brand: BrandRecord) => {
    const duplicate: BrandRecord = { ...brand, id: Date.now(), name: `${brand.name} Copy`, slug: `${brand.slug}-copy`, updatedAt: new Date().toISOString() };
    setBrands((current) => [duplicate, ...current]);
    setActivity((current) => [{ id: Date.now(), title: "Brand duplicated", detail: `${brand.name} cloned into a new concept.`, time: "Just now" }, ...current].slice(0, 4));
    toast.success("Brand duplicated", { className: "luxury-toast" });
    setConfirmAction({ type: "duplicate", brand: null });
  };

  const handleQuickAction = (action: string, brand?: BrandRecord) => {
    if (action === "assign") {
      const target = brand || selectedBrand;
      if (!target) return;
      setSelectedBrand(target);
      toast.success(`${target.name} is ready for product assignment.`, { className: "luxury-toast" });
      return;
    }
    if (action === "seo") {
      toast.success("SEO metadata generated for the current brand selection.", { className: "luxury-toast" });
      return;
    }
    if (action === "export") {
      const payload = JSON.stringify(brands, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "brands-export.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export generated", { className: "luxury-toast" });
    }
  };

  const handleImport = () => {
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
          const next = parsed.map((item: Partial<BrandRecord>, index: number) => ({ ...item, id: item.id ?? Date.now() + index, updatedAt: new Date().toISOString() }));
          setBrands(next as BrandRecord[]);
          toast.success("Brands imported", { className: "luxury-toast" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Import failed", { className: "luxury-toast" });
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse rounded-[32px] border border-[#E5E7EB] bg-white p-8">
          <div className="h-6 w-40 rounded-full bg-[#F3F4F6]" />
          <div className="mt-6 h-12 w-2/3 rounded-full bg-[#F3F4F6]" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 rounded-[24px] bg-[#F8FAFC]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700">{error}</div>;

  return (
    <div className="space-y-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-[#E5E7EB] bg-white p-8 shadow-[0_24px_70px_-34px_rgba(10,25,49,0.32)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">HOUSE OF VALERION</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[#0A1931]" style={{ fontFamily: '"Playfair Display", "Georgia", serif' }}>Brands</h2>
            <p className="mt-3 text-lg font-medium text-[#0A1931]">Luxury brand management</p>
            <p className="mt-2 text-sm leading-7 text-[#64748B]">{isParentContext ? "Parent context • Read only. Inspect brand data across active child-store brand scope." : "Manage premium fashion brands, brand identity, product collections and merchandising across the entire catalogue with an executive-grade control surface."}</p>
          </div>
          <div className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {heroMetrics.map((item, index) => {
          const Icon = item.icon;
          return (
            <BrandKpiCard key={item.label} label={item.label} value={item.value} helper={item.helper} icon={Icon} accent={item.accent} sparkline={item.sparkline} />
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard title="Top performing brands" subtitle="Revenue and momentum by label.">
          <div className="space-y-3">
            {topBrands.map((brand) => (
              <div key={brand.id} className="flex items-center justify-between rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3">
                <div>
                  <p className="font-semibold text-[#0A1931]">{brand.name}</p>
                  <p className="mt-1 text-sm text-[#64748B]">{brand.collections} collections • {brand.products} products</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#0A1931]">{formatCurrency(brand.revenue)}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-[#D4AF37]">{brand.featured ? "Featured" : "Core"}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Brand performance" subtitle="Elegant, premium analytics view.">
          <div className="relative h-[260px] w-full overflow-visible">
            {inventoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryData}>
                  <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#D4AF37" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#64748B]">No analytics data to display.</div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard title="Brand product distribution" subtitle="Balanced inventory depth across labels.">
          <div className="relative h-[280px] w-full overflow-visible">
            {distributionData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={distributionData}>
                  <defs>
                    <linearGradient id="brandRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E5E7EB" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="value" stroke="#0A1931" fill="url(#brandRevenue)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#64748B]">No brand distribution data to display.</div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Customer preference" subtitle="Preferred labels and brand resonance.">
          <div className="mx-auto flex h-[280px] max-w-[320px] items-center justify-center">
            {preferenceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={preferenceData} dataKey="value" innerRadius={70} outerRadius={110} paddingAngle={3} stroke="#fff">
                    {preferenceData.map((brand, index) => <Cell key={brand.name} fill={index % 2 === 0 ? "#0A1931" : "#D4AF37"} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-[20px] border border-dashed border-[#E5E7EB] bg-[#F8FAFC] text-sm text-[#64748B]">No preference data to display.</div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4 rounded-[28px] border border-[#E5E7EB] bg-white p-4 shadow-[0_20px_60px_-34px_rgba(10,25,49,0.28)] xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Search className="h-4 w-4" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand" className="w-full bg-transparent outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Filter className="h-4 w-4" />
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="bg-transparent outline-none">
              <option value="all">Status</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Globe2 className="h-4 w-4" />
            <select value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setPage(1); }} className="bg-transparent outline-none">
              <option value="all">Country</option>
              <option value="Italy">Italy</option>
              <option value="France">France</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <TrendingUp className="h-4 w-4" />
            <select value={revenueFilter} onChange={(event) => { setRevenueFilter(event.target.value); setPage(1); }} className="bg-transparent outline-none">
              <option value="all">Revenue</option>
              <option value="high">High</option>
              <option value="mid">Mid</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <Package className="h-4 w-4" />
            <select value={collectionsFilter} onChange={(event) => { setCollectionsFilter(event.target.value); setPage(1); }} className="bg-transparent outline-none">
              <option value="all">Collections</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
            <ChevronDown className="h-4 w-4" />
            <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} className="bg-transparent outline-none">
              <option value="revenue">Sort by revenue</option>
              <option value="name">Sort by name</option>
              <option value="products">Sort by products</option>
              <option value="collections">Sort by collections</option>
              <option value="updated">Sort by updated</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={resetFilters} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Reset</button>
          {!isParentContext && <button type="button" onClick={handleImport} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Import</button>}
          <button type="button" onClick={() => handleQuickAction("export")} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Export</button>
          {!isParentContext && <button type="button" onClick={openCreateComposer} className="rounded-full bg-[#0A1931] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#102B4F]">Create brand</button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_20px_60px_-34px_rgba(10,25,49,0.28)]">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D4AF37]">Brand catalogue</p>
              <p className="mt-1 text-sm text-[#64748B]">Luxury brand roster with premium actions.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#64748B]">
                <span className="mr-2">Rows</span>
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="bg-transparent outline-none">
                  <option value={6}>6</option>
                  <option value={10}>10</option>
                  <option value={14}>14</option>
                </select>
              </label>
              <button type="button" onClick={toggleSelectAll} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">
                {selectedIds.length === paginatedBrands.length && paginatedBrands.length ? "Clear" : "Select all"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-left text-[#64748B]">
                <tr>
                  <th className="px-4 py-4"><input type="checkbox" checked={selectedIds.length === paginatedBrands.length && paginatedBrands.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-[#E5E7EB] text-[#D4AF37]" /></th>
                  <th className="px-4 py-4 font-semibold">Brand</th>
                  <th className="px-4 py-4 font-semibold">Country</th>
                  <th className="px-4 py-4 font-semibold">Products</th>
                  <th className="px-4 py-4 font-semibold">Collections</th>
                  <th className="px-4 py-4 font-semibold">Revenue</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Feature</th>
                  <th className="px-4 py-4 font-semibold">Updated</th>
                  <th className="px-4 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBrands.map((brand) => (
                  <tr key={brand.id} className="border-t border-[#E5E7EB] bg-white transition hover:bg-[#FFF8E8]">
                    <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(brand.id)} onChange={() => toggleSelection(brand.id)} className="h-4 w-4 rounded border-[#E5E7EB] text-[#D4AF37]" /></td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => setSelectedBrand(brand)} className="flex items-center gap-3 text-left">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#E5E7EB] text-sm font-semibold text-[#0A1931]" style={{ backgroundColor: `${brand.color}16` }}>
                          {brand.name.split(" ").map((chunk) => chunk[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0A1931]">{brand.name}</p>
                          <p className="mt-1 text-xs text-[#64748B]">{brand.tagLine || brand.description}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-[#64748B]">{brand.country}</td>
                    <td className="px-4 py-4 text-[#0A1931]">{brand.products}</td>
                    <td className="px-4 py-4 text-[#0A1931]">{brand.collections}</td>
                    <td className="px-4 py-4 text-[#0A1931]">{formatCurrency(brand.revenue)}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(brand.status)}`}>{brand.status}</span></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeatureTone(brand.featured)}`}>{brand.featured ? "Featured" : "Standard"}</span></td>
                    <td className="px-4 py-4 text-[#64748B]">{formatDateLabel(brand.updatedAt)}</td>
                    <td className="px-4 py-4">
                      {!isParentContext ? (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEditComposer(brand)} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Edit"><Edit className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setConfirmAction({ type: "duplicate", brand })} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Duplicate"><Copy className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setConfirmAction({ type: "archive", brand })} className="rounded-full border border-[#E5E7EB] bg-white p-2 text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]" title="Archive"><Archive className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setConfirmAction({ type: "delete", brand })} className="rounded-full border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 text-sm text-[#64748B]">
            <p>Showing {paginatedBrands.length} of {filteredBrands.length} brands</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <span>Page {page} / {pageCount}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#0A1931] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <SectionCard title="Featured brands" subtitle="Premium showcase of the current portfolio.">
            <div className="space-y-4">
              {brands.filter((brand) => brand.featured).slice(0, 3).map((brand) => (
                <motion.div key={brand.id} whileHover={{ y: -3, scale: 1.01 }} className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC]">
                  <div className="h-20" style={{ background: `linear-gradient(135deg, ${brand.color} 0%, #F8D96B 100%)` }} />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#0A1931]">{brand.name}</p>
                        <p className="mt-1 text-sm text-[#64748B]">{brand.products} products • {brand.collections} collections</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getFeatureTone(brand.featured)}`}>{brand.featured ? "Featured" : "Standard"}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedBrand(brand)} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">View</button>
                      {!isParentContext && <button type="button" onClick={() => openEditComposer(brand)} className="rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Edit</button>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recent activity" subtitle="Latest brand actions and launches.">
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="rounded-[18px] border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                  <p className="text-sm font-semibold text-[#0A1931]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#64748B]">{item.detail}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#64748B]">{item.time}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {selectedBrand ? (
        <SectionCard title="Brand details" subtitle="Premium executive view of the selected brand.">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC]">
              <div className="h-28" style={{ background: `linear-gradient(135deg, ${selectedBrand.color} 0%, #F8D96B 100%)` }} />
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white text-lg font-semibold text-[#0A1931]">
                    {selectedBrand.name.split(" ").map((chunk) => chunk[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#0A1931]">{selectedBrand.name}</h3>
                    <p className="text-sm text-[#64748B]">{selectedBrand.tagLine || selectedBrand.description}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#4B5563]">{selectedBrand.story}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#64748B]">Country</p>
                    <p className="mt-2 font-semibold text-[#0A1931]">{selectedBrand.country}</p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#64748B]">Founder</p>
                    <p className="mt-2 font-semibold text-[#0A1931]">{selectedBrand.founder}</p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#64748B]">Established</p>
                    <p className="mt-2 font-semibold text-[#0A1931]">{selectedBrand.established}</p>
                  </div>
                  <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-3">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-[#64748B]">Revenue</p>
                    <p className="mt-2 font-semibold text-[#0A1931]">{formatCurrency(selectedBrand.revenue)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D4AF37]">Luxury preview</p>
                <div className="mt-4 rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <div className="rounded-[18px] border border-[#E5E7EB] bg-white p-4">
                    <div className="h-24 rounded-[16px]" style={{ background: `linear-gradient(135deg, ${selectedBrand.color} 0%, #F8D96B 100%)` }} />
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#0A1931]">{selectedBrand.name}</p>
                        <p className="mt-1 text-sm text-[#64748B]">{selectedBrand.website}</p>
                      </div>
                      <span className="rounded-full border border-[#D4AF37]/20 bg-[#FFF8E8] px-3 py-1 text-xs font-semibold text-[#D4AF37]">Signature</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#D4AF37]">Quick actions</p>
                <div className="mt-4 grid gap-2">
                  {!isParentContext && <button type="button" onClick={() => handleQuickAction("assign", selectedBrand)} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-left text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Assign products</button>}
                  {!isParentContext && <button type="button" onClick={openCreateComposer} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-left text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Create brand</button>}
                  {!isParentContext && <button type="button" onClick={() => handleQuickAction("seo")} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-left text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Generate SEO</button>}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {brands.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-[#E5E7EB] bg-white p-10 text-center shadow-[0_20px_60px_-34px_rgba(10,25,49,0.28)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF8E8] text-[#D4AF37]">
            <Sparkles className="h-8 w-8" />
          </div>
          <h3 className="mt-6 text-2xl font-semibold text-[#0A1931]">No brands yet</h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#64748B]">Launch your first luxury brand experience and begin building a premium portfolio for your editorial storefront.</p>
          {!isParentContext && <button type="button" onClick={openCreateComposer} className="mt-6 rounded-full bg-[#0A1931] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#102B4F]">Create brand</button>}
        </motion.div>
      ) : null}

      <AnimatePresence>
        {composerOpen && !isParentContext ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A1931]/70 px-4 py-8 backdrop-blur-sm">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-[32px] border border-[#E5E7EB] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(10,25,49,0.5)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">Brand editor</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#0A1931]">{mode === "edit" ? "Edit brand" : "Create brand"}</h3>
                </div>
                <button type="button" onClick={closeComposer} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Cancel</button>
              </div>

              <form onSubmit={handleSave} className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#0A1931]">Core brand details</h4>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Brand name</span>
                        <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Slug</span>
                        <input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Tagline</span>
                        <input value={draft.tagLine} onChange={(event) => setDraft((current) => ({ ...current, tagLine: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Website</span>
                        <input value={draft.website} onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Country</span>
                        <input value={draft.country} onChange={(event) => setDraft((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Founder</span>
                        <input value={draft.founder} onChange={(event) => setDraft((current) => ({ ...current, founder: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Established</span>
                        <input value={draft.established} onChange={(event) => setDraft((current) => ({ ...current, established: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Collections</span>
                        <input type="number" value={draft.collections} onChange={(event) => setDraft((current) => ({ ...current, collections: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Brand color</span>
                        <div className="flex items-center gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3">
                          <input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} className="h-10 w-12 rounded-lg border border-[#E5E7EB]" />
                          <span className="text-sm text-[#64748B]">Signature accent palette</span>
                        </div>
                      </label>
                      <div className="grid gap-2 rounded-[18px] border border-[#E5E7EB] bg-white p-3 text-sm text-[#64748B]">
                        <label className="flex items-center justify-between gap-2">
                          <span>Status</span>
                          <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as BrandRecord["status"] }))} className="rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 outline-none">
                            <option value="ACTIVE">Active</option>
                            <option value="DRAFT">Draft</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </label>
                        <label className="flex items-center justify-between gap-2">
                          <span>Featured</span>
                          <input type="checkbox" checked={draft.featured} onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))} className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37]" />
                        </label>
                      </div>
                    </div>
                    <label className="mt-4 block text-sm text-[#64748B]">
                      <span className="mb-2 block font-semibold text-[#0A1931]">Description</span>
                      <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                    </label>
                    <label className="mt-4 block text-sm text-[#64748B]">
                      <span className="mb-2 block font-semibold text-[#0A1931]">Brand story</span>
                      <textarea value={draft.story} onChange={(event) => setDraft((current) => ({ ...current, story: event.target.value }))} rows={4} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                    </label>
                  </section>

                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#0A1931]">Media & SEO</h4>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[18px] border border-dashed border-[#E5E7EB] bg-white p-3">
                        <p className="text-sm font-semibold text-[#0A1931]">Brand logo</p>
                        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, "logoUrl")} className="mt-3 rounded-[16px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-center">
                          <input type="file" accept="image/*" onChange={(event) => handleImageUpload("logoUrl", event.target.files?.[0])} className="w-full text-sm" />
                          {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo preview" className="mx-auto mt-3 h-16 w-16 rounded-2xl object-cover" /> : <p className="mt-3 text-sm text-[#64748B]">Drag and drop logo assets</p>}
                        </div>
                      </div>
                      <div className="rounded-[18px] border border-dashed border-[#E5E7EB] bg-white p-3">
                        <p className="text-sm font-semibold text-[#0A1931]">Brand cover</p>
                        <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, "coverUrl")} className="mt-3 rounded-[16px] border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-center">
                          <input type="file" accept="image/*" onChange={(event) => handleImageUpload("coverUrl", event.target.files?.[0])} className="w-full text-sm" />
                          {draft.coverUrl ? <img src={draft.coverUrl} alt="Cover preview" className="mx-auto mt-3 h-24 w-full rounded-2xl object-cover" /> : <p className="mt-3 text-sm text-[#64748B]">Drag and drop hero assets</p>}
                        </div>
                      </div>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">Crop mode</span>
                        <select value={cropMode} onChange={(event) => setCropMode(event.target.value)} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]">
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                          <option value="fit">Fit</option>
                        </select>
                      </label>
                      <label className="text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">SEO title</span>
                        <input value={draft.seoTitle} onChange={(event) => setDraft((current) => ({ ...current, seoTitle: event.target.value }))} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                      <label className="md:col-span-2 text-sm text-[#64748B]">
                        <span className="mb-2 block font-semibold text-[#0A1931]">SEO description</span>
                        <textarea value={draft.seoDescription} onChange={(event) => setDraft((current) => ({ ...current, seoDescription: event.target.value }))} rows={3} className="w-full rounded-[18px] border border-[#E5E7EB] bg-white px-3 py-3 outline-none transition focus:border-[#D4AF37]" />
                      </label>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-[#D4AF37]" />
                      <h4 className="text-lg font-semibold text-[#0A1931]">Live preview</h4>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white">
                      <div className="h-24" style={{ background: `linear-gradient(135deg, ${draft.color} 0%, #F8D96B 100%)`, backgroundPosition: cropMode === "top" ? "top" : cropMode === "fit" ? "center" : "center", backgroundSize: cropMode === "fit" ? "contain" : "cover" }} />
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] text-sm font-semibold text-[#0A1931]">
                            {draft.name ? draft.name.slice(0, 2).toUpperCase() : "BR"}
                          </div>
                          <div>
                            <p className="font-semibold text-[#0A1931]">{draft.name || "Brand preview"}</p>
                            <p className="text-sm text-[#64748B]">{draft.tagLine || draft.description || "Luxury brand preview"}</p>
                          </div>
                        </div>
                        <div className="mt-4 rounded-[18px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.32em] text-[#D4AF37]">Website preview</p>
                              <p className="mt-2 text-sm text-[#64748B]">{draft.website || "brand.example.com"}</p>
                            </div>
                            <span className="rounded-full bg-[#0A1931] px-3 py-1 text-xs font-semibold text-white">Preview</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                    <h4 className="text-lg font-semibold text-[#0A1931]">Actions</h4>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="submit" disabled={saving} className="rounded-full bg-[#0A1931] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#102B4F] disabled:opacity-60">{saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}</button>
                      <button type="button" onClick={() => handleQuickAction("seo")} className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Generate SEO</button>
                      <button type="button" onClick={closeComposer} className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Cancel</button>
                    </div>
                  </section>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmAction.brand ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A1931]/70 px-4 py-8 backdrop-blur-sm">
            <motion.div initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="w-full max-w-md rounded-[28px] border border-[#E5E7EB] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(10,25,49,0.5)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-[#D4AF37]">Confirm action</p>
              <h3 className="mt-3 text-xl font-semibold text-[#0A1931]">{confirmAction.type === "delete" ? "Delete" : confirmAction.type === "archive" ? "Archive" : "Duplicate"} {confirmAction.brand.name}?</h3>
              <p className="mt-3 text-sm leading-7 text-[#64748B]">This will update the portfolio view immediately and keep the rest of the admin experience aligned with the latest editorial state.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmAction({ type: confirmAction.type, brand: null })} className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2 text-sm font-semibold text-[#0A1931] transition hover:border-[#D4AF37] hover:bg-[#FFF8E8]">Cancel</button>
                <button type="button" onClick={() => {
                  const selectedBrand = confirmAction.brand;
                  if (!selectedBrand) {
                    setConfirmAction({ type: confirmAction.type, brand: null });
                    return;
                  }
                  if (confirmAction.type === "delete") handleDelete(selectedBrand);
                  if (confirmAction.type === "archive") handleArchive(selectedBrand);
                  if (confirmAction.type === "duplicate") handleDuplicate(selectedBrand);
                }} className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition ${confirmAction.type === "delete" ? "bg-rose-600 hover:bg-rose-700" : "bg-[#0A1931] hover:bg-[#102B4F]"}`}>
                  {confirmAction.type === "delete" ? "Delete" : confirmAction.type === "archive" ? "Archive" : "Duplicate"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
