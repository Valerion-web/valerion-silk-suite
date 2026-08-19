import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Bell,
  ChevronDown,
  Download,
  Plus,
  RefreshCcw,
  Search,
  Upload,
  Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { products as storefrontProducts } from "@/data/products";
import InventoryTable from "./InventoryTable";
import type { InventoryItem, SortKey } from "./types";

const palette = {
  navy: "#041E42",
  gold: "#D4AF37",
  green: "#22C55E",
  orange: "#F59E0B",
  blue: "#2563EB",
  red: "#DC2626",
};

const warehouseOptions = ["Main Warehouse", "Flagship Boutique", "Regional Hub", "Outlet Warehouse"];
const categoryOptions = ["Tuxedos", "Silk Shirts", "Luxury Blazers", "Formalwear", "Premium Shirts", "Accessories", "Tailored Suits"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });

const formatHeaderDate = () =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date());

const deriveStatus = (stock: number, reorderLevel: number) => {
  if (stock <= 0) return "OUT_OF_STOCK" as const;
  if (stock <= reorderLevel) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
};

const downloadFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const buildSeedInventory = (): InventoryItem[] =>
  storefrontProducts.slice(0, 12).map((product, index) => {
    const currentStock = 18 + index * 5;
    const reservedStock = index % 3 === 0 ? 4 : 1;
    const reorderLevel = 8 + (index % 4);
    const warehouse = warehouseOptions[index % warehouseOptions.length];
    const now = new Date();
    now.setDate(now.getDate() - index * 2);

    return {
      id: 1000 + index,
      productId: product.id,
      name: product.name,
      sku: `VL-${String(index + 1).padStart(3, "0")}`,
      category: product.category,
      warehouse,
      currentStock,
      reservedStock,
      reorderLevel,
      unitCost: Math.round(product.price * 0.62),
      price: product.price,
      image: typeof product.image === "string" ? product.image : undefined,
      status: deriveStatus(currentStock, reorderLevel),
      lastUpdated: now.toISOString(),
      history: [
        {
          id: Date.now() + index,
          type: "create",
          quantity: currentStock,
          note: "Seeded inventory item",
          timestamp: now.toISOString(),
          warehouse,
        },
      ],
    };
  });

const getStatusMetadata = (item: InventoryItem) => {
  if (item.status === "OUT_OF_STOCK") return { label: "Out of stock", bg: "#FEE2E2", text: "#B91C1C" };
  if (item.status === "LOW_STOCK") return { label: "Low stock", bg: "#FFF7ED", text: "#92400E" };
  if (item.reservedStock > 0) return { label: "Reserved", bg: "#EFF6FF", text: "#1D4ED8" };
  return { label: "In stock", bg: "#ECFDF5", text: "#166534" };
};

export default function InventoryModule() {
  const [inventory, setInventory] = useState<InventoryItem[]>(() => buildSeedInventory());
  const [query, setQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 320);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => setPage(1), [query, warehouseFilter, categoryFilter, statusFilter, pageSize]);

  const filteredInventory = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return inventory.filter((item) => {
      const matchesQuery =
        normalized.length === 0 ||
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized);
      const matchesWarehouse = warehouseFilter === "all" || item.warehouse === warehouseFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "inStock" && item.status === "IN_STOCK") ||
        (statusFilter === "lowStock" && item.status === "LOW_STOCK") ||
        (statusFilter === "outOfStock" && item.status === "OUT_OF_STOCK");
      return matchesQuery && matchesWarehouse && matchesCategory && matchesStatus;
    });
  }, [inventory, query, warehouseFilter, categoryFilter, statusFilter]);

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
      return 0;
    });
    return items;
  }, [filteredInventory, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedInventory.length / pageSize));
  const paginatedInventory = useMemo(
    () => sortedInventory.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
    [sortedInventory, page, pageSize]
  );

  const activeFilters = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (warehouseFilter !== "all") items.push({ label: "Warehouse", value: warehouseFilter });
    if (categoryFilter !== "all") items.push({ label: "Category", value: categoryFilter });
    if (statusFilter !== "all")
      items.push({ label: "Status", value: statusFilter === "inStock" ? "In stock" : statusFilter === "lowStock" ? "Low stock" : "Out of stock" });
    if (query.trim()) items.push({ label: "Search", value: query.trim() });
    return items;
  }, [categoryFilter, query, statusFilter, warehouseFilter]);

  const stats = useMemo(() => {
    const totalSkus = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.currentStock, 0);
    const inStock = inventory.filter((item) => item.status === "IN_STOCK").length;
    const lowStock = inventory.filter((item) => item.status === "LOW_STOCK").length;
    const outOfStock = inventory.filter((item) => item.status === "OUT_OF_STOCK").length;
    const reservedStock = inventory.reduce((sum, item) => sum + item.reservedStock, 0);
    const inventoryValue = inventory.reduce((sum, item) => sum + item.currentStock * item.unitCost, 0);
    return { totalSkus, totalStock, inStock, lowStock, outOfStock, reservedStock, inventoryValue };
  }, [inventory]);

  const analyticsCards = useMemo(
    () => [
      { label: "Total Products", value: stats.totalSkus.toString(), subtitle: "SKUs in catalog", percentage: "+4.8%", color: palette.navy, sparkline: [12, 14, 13, 16, 18, 17] },
      { label: "Total Units", value: stats.totalStock.toString(), subtitle: "Units tracked", percentage: "+3.2%", color: palette.gold, sparkline: [14, 16, 15, 18, 20, 19] },
      { label: "Inventory Value", value: formatCurrency(stats.inventoryValue), subtitle: "Stock replacement cost", percentage: "+8.4%", color: palette.gold, sparkline: [18, 24, 22, 30, 29, 36] },
      { label: "In Stock", value: stats.inStock.toString(), subtitle: "Products ready to ship", percentage: "+2.1%", color: palette.green, sparkline: [11, 13, 15, 17, 16, 18] },
      { label: "Low Stock", value: stats.lowStock.toString(), subtitle: "Reorder candidates", percentage: "-1.7%", color: palette.orange, sparkline: [12, 10, 9, 8, 7, 6] },
      { label: "Out of Stock", value: stats.outOfStock.toString(), subtitle: "Unavailable SKUs", percentage: "-0.8%", color: palette.red, sparkline: [8, 7, 6, 5, 4, 3] },
    ],
    [stats]
  );

  const distributionData = useMemo(() => {
    const items = [
      { name: "In Stock", value: inventory.reduce((sum, item) => sum + (item.status === "IN_STOCK" ? item.currentStock : 0), 0), color: palette.green },
      { name: "Reserved", value: inventory.reduce((sum, item) => sum + item.reservedStock, 0), color: palette.blue },
      { name: "Low Stock", value: inventory.reduce((sum, item) => sum + (item.status === "LOW_STOCK" ? item.currentStock : 0), 0), color: palette.orange },
      { name: "Out of Stock", value: inventory.reduce((sum, item) => sum + (item.status === "OUT_OF_STOCK" ? item.currentStock : 0), 0), color: palette.red },
    ];
    const totalUnits = items.reduce((sum, entry) => sum + entry.value, 0) || 1;
    return items.map((entry) => ({ ...entry, percent: Number(((entry.value / totalUnits) * 100).toFixed(1)) }));
  }, [inventory]);

  const distributionSummary = useMemo(
    () => ({
      totalUnits: distributionData.reduce((sum, entry) => sum + entry.value, 0),
      totalProducts: inventory.length,
      inventoryHealth: distributionData.some((entry) => entry.name === "Out of Stock" && entry.value > 0) ? "Watch" : "Healthy",
    }),
    [distributionData, inventory.length]
  );

  const warehouseDistribution = useMemo(() => {
    const data = [
      { name: "Main Warehouse", value: Math.max(40, Math.round(stats.totalStock * 0.38)), color: palette.navy },
      { name: "Flagship Boutique", value: Math.max(26, Math.round(stats.totalStock * 0.24)), color: palette.gold },
      { name: "Regional Hub", value: Math.max(20, Math.round(stats.totalStock * 0.18)), color: palette.green },
      { name: "Outlet Warehouse", value: Math.max(16, Math.round(stats.totalStock * 0.2)), color: palette.blue },
    ];
    const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;
    const reservedRatio = stats.totalStock > 0 ? stats.reservedStock / stats.totalStock : 0;
    return data.map((entry) => {
      const reserved = Math.round(entry.value * reservedRatio);
      const available = Math.max(0, entry.value - reserved);
      return { ...entry, percent: Math.round((entry.value / total) * 100), reserved, available };
    });
  }, [stats.totalStock, stats.reservedStock]);

  const inventoryMovement = useMemo(
    () => [
      { month: "Jan", added: 18, sold: 11, returned: 2, adjusted: 3 },
      { month: "Feb", added: 20, sold: 12, returned: 3, adjusted: 2 },
      { month: "Mar", added: 22, sold: 13, returned: 2, adjusted: 4 },
      { month: "Apr", added: 24, sold: 15, returned: 4, adjusted: 2 },
      { month: "May", added: 27, sold: 14, returned: 3, adjusted: 3 },
      { month: "Jun", added: 30, sold: 16, returned: 4, adjusted: 2 },
      { month: "Jul", added: 28, sold: 17, returned: 3, adjusted: 3 },
    ],
    []
  );

  const inventoryValueTrend = useMemo(() => {
    const base = Math.max(1800000, stats.inventoryValue / 12);
    return [
      { month: "Jan", value: Math.round(base * 0.94) },
      { month: "Feb", value: Math.round(base * 0.97) },
      { month: "Mar", value: Math.round(base * 1.01) },
      { month: "Apr", value: Math.round(base * 1.06) },
      { month: "May", value: Math.round(base * 1.11) },
      { month: "Jun", value: Math.round(base * 1.16) },
      { month: "Jul", value: Math.round(base * 1.21) },
    ];
  }, [stats.inventoryValue]);

  const lowStockTrend = useMemo(
    () => [
      { month: "Jan", value: 4 },
      { month: "Feb", value: 5 },
      { month: "Mar", value: 4 },
      { month: "Apr", value: 6 },
      { month: "May", value: 5 },
      { month: "Jun", value: 7 },
      { month: "Jul", value: 6 },
    ],
    []
  );

  const categoryDistribution = useMemo(() => {
    const counts = inventory.reduce<Record<string, number>>((acc, item) => {
      const normalized = item.category.includes("Suit")
        ? "Suits"
        : item.category.includes("Blazer")
        ? "Blazers"
        : item.category.includes("Shirt")
        ? "Shirts"
        : item.category.includes("Trouser")
        ? "Trousers"
        : "Accessories";
      acc[normalized] = (acc[normalized] || 0) + 1;
      return acc;
    }, {});
    return [
      { name: "Shirts", value: counts.Shirts || 2, color: palette.gold },
      { name: "Blazers", value: counts.Blazers || 2, color: palette.navy },
      { name: "Suits", value: counts.Suits || 2, color: palette.green },
      { name: "Trousers", value: counts.Trousers || 1, color: palette.blue },
      { name: "Accessories", value: counts.Accessories || 3, color: palette.red },
    ];
  }, [inventory]);

  const resetFilters = () => {
    setQuery("");
    setWarehouseFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      toast.success("Inventory refreshed");
    }, 300);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please import a CSV file.");
      event.target.value = "";
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const rows = text.split(/\r?\n/).filter(Boolean);
        const headers = rows[0].split(",");
        const imported = rows.slice(1).map((row, index) => {
          const values = row.split(",");
          const record = {
            name: values[headers.indexOf("name")] || `Imported item ${index + 1}`,
            sku: values[headers.indexOf("sku")] || `IM-${index + 1}`,
            category: values[headers.indexOf("category")] || "Accessories",
            warehouse: values[headers.indexOf("warehouse")] || warehouseOptions[0],
            currentStock: Number(values[headers.indexOf("currentStock")]) || 0,
            reservedStock: Number(values[headers.indexOf("reservedStock")]) || 0,
            reorderLevel: Number(values[headers.indexOf("reorderLevel")]) || 5,
            unitCost: Number(values[headers.indexOf("unitCost")]) || 500,
            price: Number(values[headers.indexOf("price")]) || 1000,
          };
          return {
            id: Date.now() + index,
            productId: `import-${index}`,
            name: record.name,
            sku: record.sku,
            category: record.category,
            warehouse: record.warehouse,
            currentStock: record.currentStock,
            reservedStock: record.reservedStock,
            reorderLevel: record.reorderLevel,
            unitCost: record.unitCost,
            price: record.price,
            status: deriveStatus(record.currentStock, record.reorderLevel),
            image: undefined,
            lastUpdated: new Date().toISOString(),
            history: [
              {
                id: Date.now() + index + 1,
                type: "create",
                quantity: record.currentStock,
                note: "Imported from CSV",
                timestamp: new Date().toISOString(),
                warehouse: record.warehouse,
              },
            ],
          };
        });
        setInventory((current) => [...imported, ...current]);
        toast.success(`${imported.length} inventory rows imported`);
      } catch {
        toast.error("Could not parse the CSV file.");
      } finally {
        setIsImporting(false);
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    setIsExporting(true);
    const headers = ["name", "sku", "category", "warehouse", "currentStock", "reservedStock", "reorderLevel", "unitCost", "price", "status", "lastUpdated"];
    const body = inventory
      .map((item) =>
        headers
          .map((key) => {
            const value = item[key as keyof InventoryItem];
            return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(",")
      )
      .join("\n");
    downloadFile("inventory.csv", [headers.join(","), body].join("\n"), "text/csv");
    window.setTimeout(() => setIsExporting(false), 300);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
  };

  if (isLoading) {
    return (
      <div className="w-full bg-[#F8F7F4] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-28 rounded-[18px] bg-[#F4EEE0]" />
          <div className="grid gap-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-40 rounded-[18px] bg-[#F4EEE0]" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="h-[420px] rounded-[18px] bg-[#F4EEE0]" />
            <div className="h-[420px] rounded-[18px] bg-[#F4EEE0]" />
            <div className="h-[420px] rounded-[18px] bg-[#F4EEE0]" />
          </div>
          <div className="h-[560px] rounded-[18px] bg-[#F4EEE0]" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#F8F7F4] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_20px_45px_-28px_rgba(4,30,66,0.14)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.32em] text-[#C9A227]">
                <span>House of Valerion</span>
                <span className="text-[#C9A227]/50">/</span>
                <span>Inventory</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#041E42]">Inventory Management</h1>
              <p className="max-w-2xl text-sm leading-7 text-[#4B5563]">Track stock across warehouses and monitor inventory performance in one premium dashboard.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleRefresh} className="inline-flex items-center gap-2 rounded-full border border-[#E8DEC1] bg-[#FFFBF3] px-4 py-3 text-sm font-semibold text-[#041E42] transition hover:bg-[#F7F1E5]">
                <RefreshCcw className="h-4 w-4" /> Refresh
              </button>
              <label htmlFor="inventory-import" className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E8DEC1] bg-[#FFFBF3] px-4 py-3 text-sm font-semibold text-[#041E42] transition hover:bg-[#F7F1E5]">
                <Upload className="h-4 w-4" /> Import
              </label>
              <input id="inventory-import" type="file" accept=".csv" onChange={handleImport} className="hidden" />
              <button type="button" onClick={handleExportCsv} className="inline-flex items-center gap-2 rounded-full border border-[#E8DEC1] bg-[#FFFBF3] px-4 py-3 text-sm font-semibold text-[#041E42] transition hover:bg-[#F7F1E5]">
                <Download className="h-4 w-4" /> Export
              </button>
              <button type="button" onClick={() => toast.success("Add inventory flow pending")}
                className="inline-flex items-center gap-2 rounded-full bg-[#041E42] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#072e63]">
                <Plus className="h-4 w-4" /> Add Inventory
              </button>
              <button type="button" className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#E8DEC1] bg-white text-[#041E42] shadow-sm">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Overview</p>
                <p className="mt-2 text-2xl font-semibold text-[#041E42]">Inventory Performance</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E8DEC1] bg-[#FFFBF3] px-4 py-2 text-sm font-semibold text-[#041E42]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Healthy
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {analyticsCards.map((card) => (
                <div key={card.label} className="rounded-[18px] border border-[#E8DEC1] bg-[#F8F7F4] p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-[#6B7280]">{card.label}</p>
                      <p className="mt-3 text-3xl font-semibold text-[#041E42]">{card.value}</p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#041E42]">{card.percentage}</div>
                  </div>
                  <p className="mt-4 text-sm text-[#6B7280]">{card.subtitle}</p>
                  <div className="mt-4 overflow-hidden rounded-full bg-[#EDE9D9]">
                    <svg viewBox="0 0 100 100" className="h-12 w-full">
                      <polyline
                        points={card.sparkline.map((value, index) => `${(index * 100) / (card.sparkline.length - 1)},${100 - value * 4}`).join(" ")}
                        fill="none"
                        stroke={card.color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Date</p>
                <p className="mt-2 text-2xl font-semibold text-[#041E42]">{formatHeaderDate()}</p>
              </div>
              <div className="inline-flex items-center gap-3 rounded-full border border-[#E8DEC1] bg-[#F8F7F4] px-4 py-3 text-sm font-semibold text-[#041E42]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" /> Stable
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="rounded-[18px] bg-[#F8F7F4] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-[#6B7280]">Inventory Health</p>
                <p className="mt-3 text-3xl font-semibold text-[#041E42]">Balanced and ready</p>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">Stock is optimized across top-performing warehouses.</p>
              </div>
              <div className="rounded-[18px] bg-[#F8F7F4] p-5">
                <p className="text-xs uppercase tracking-[0.28em] text-[#6B7280]">Priority</p>
                <p className="mt-3 text-lg font-semibold text-[#041E42]">Review low stock products first.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Distribution</p>
                <p className="mt-2 text-xl font-semibold text-[#041E42]">Inventory Distribution</p>
              </div>
              <span className="rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-semibold text-[#166534]">Donut</span>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={distributionData} dataKey="value" innerRadius={72} outerRadius={100} cornerRadius={18} paddingAngle={6} stroke="transparent">
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} units`} cursor={false} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="rounded-[18px] bg-[#F8F7F4] p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-[#6B7280]">Total units</p>
                  <p className="mt-2 text-3xl font-semibold text-[#041E42]">{distributionSummary.totalUnits}</p>
                </div>
                <div className="rounded-[18px] bg-[#F8F7F4] p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-[#6B7280]">Inventory health</p>
                  <p className="mt-2 text-2xl font-semibold text-[#041E42]">{distributionSummary.inventoryHealth}</p>
                </div>
                <div className="space-y-3">
                  {distributionData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E8DEC1] bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <div>
                          <p className="text-sm font-semibold text-[#041E42]">{entry.name}</p>
                          <p className="text-xs text-[#6B7280]">{entry.percent}%</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[#041E42]">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Value trend</p>
                <p className="mt-2 text-xl font-semibold text-[#041E42]">Inventory Value Trend</p>
              </div>
              <div className="inline-flex overflow-hidden rounded-full border border-[#E8DEC1] bg-[#F8F7F4] text-sm">
                {['Monthly', 'Quarterly', 'Yearly'].map((label, index) => (
                  <button key={label} type="button" className={`px-4 py-2 ${index === 0 ? "bg-[#041E42] text-white" : "text-[#6B7280]"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={inventoryValueTrend} margin={{ top: 16, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E7E3D7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} tickFormatter={(value) => `${Math.round(value / 100000)}K`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="value" stroke={palette.gold} strokeWidth={4} dot={false} activeDot={{ r: 6, stroke: palette.navy, strokeWidth: 3, fill: palette.gold }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Warehouse allocation</p>
                <p className="mt-2 text-xl font-semibold text-[#041E42]">Warehouse Distribution</p>
              </div>
              <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1D4ED8]">Live split</span>
            </div>
            <div className="mt-6 space-y-5">
              {warehouseDistribution.map((warehouse) => (
                <div key={warehouse.name} className="space-y-3 rounded-[18px] border border-[#E8DEC1] bg-[#F8F7F4] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#041E42]">{warehouse.name}</p>
                      <p className="text-xs text-[#6B7280]">{warehouse.percent}% of stock</p>
                    </div>
                    <p className="text-sm font-semibold text-[#041E42]">{warehouse.value} units</p>
                  </div>
                  <div className="h-3.5 overflow-hidden rounded-full bg-[#E7E4DA]">
                    <div className="h-full rounded-full bg-[#041E42]" style={{ width: `${warehouse.percent}%` }} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-white px-4 py-3 text-sm text-[#041E42] shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">Available</p>
                      <p className="mt-2 text-sm font-semibold">{warehouse.available}</p>
                    </div>
                    <div className="rounded-[14px] bg-white px-4 py-3 text-sm text-[#041E42] shadow-sm">
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[#6B7280]">Reserved</p>
                      <p className="mt-2 text-sm font-semibold">{warehouse.reserved}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Movement</p>
            <p className="mt-2 text-xl font-semibold text-[#041E42]">Inventory Movement</p>
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={inventoryMovement} margin={{ top: 12, right: 0, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#E7E3D7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${value} units`} />
                  <Bar dataKey="added" stackId="inventory" fill={palette.green} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="sold" stackId="inventory" fill={palette.navy} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="returned" stackId="inventory" fill={palette.gold} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="adjusted" stackId="inventory" fill={palette.orange} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Low stock trend</p>
                <p className="mt-2 text-xl font-semibold text-[#041E42]">Low Stock Trend</p>
              </div>
              <span className="rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#B45309]">Alert</span>
            </div>
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={lowStockTrend} margin={{ top: 20, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#E7E3D7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${value} items`} />
                  <Line type="monotone" dataKey="value" stroke={palette.orange} strokeWidth={4} dot={false} activeDot={{ r: 6, fill: palette.orange }} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
            <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Category mix</p>
            <p className="mt-2 text-xl font-semibold text-[#041E42]">Inventory by Category</p>
            <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={categoryDistribution} dataKey="value" innerRadius={72} outerRadius={98} cornerRadius={16} paddingAngle={6} stroke="transparent">
                      {categoryDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} SKUs`} cursor={false} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {categoryDistribution.map((entry) => {
                  const total = categoryDistribution.reduce((sum, item) => sum + item.value, 0) || 1;
                  const percent = Math.round((entry.value / total) * 100);
                  return (
                    <div key={entry.name} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E8DEC1] bg-[#F8F7F4] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <div>
                          <p className="text-sm font-semibold text-[#041E42]">{entry.name}</p>
                          <p className="text-xs text-[#6B7280]">{entry.value} SKUs</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[#041E42]">{percent}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_24px_60px_-36px_rgba(4,30,66,0.14)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#C9A227]">Inventory List</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#041E42]">Inventory List</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#4B5563]">Full stock roster with warehouse and availability details.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {activeFilters.map((filter) => (
                <span key={`${filter.label}-${filter.value}`} className="rounded-full border border-[#E8DEC1] bg-[#FFFBF3] px-4 py-2 text-sm text-[#041E42]">
                  {filter.label}: {filter.value}
                </span>
              ))}
              {activeFilters.length > 0 ? (
                <button type="button" onClick={resetFilters} className="rounded-full border border-[#D4AF37] bg-white px-4 py-2 text-sm font-semibold text-[#041E42] transition hover:bg-[#FFFBF3]">
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <InventoryTable
              items={paginatedInventory}
              visibleCount={sortedInventory.length}
              query={query}
              onQueryChange={setQuery}
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
              onSort={toggleSort}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              hasActiveFilters={activeFilters.length > 0}
              activeFilterCount={activeFilters.length}
              onClearFilters={resetFilters}
              menuOpenId={menuOpenId}
              onMenuToggle={setMenuOpenId}
              warehouseOptions={warehouseOptions}
              categoryOptions={categoryOptions}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
