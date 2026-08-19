import { ChevronDown, MoreHorizontal, Search, Warehouse } from "lucide-react";
import type { InventoryItem, SortKey } from "./types";

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });

const getStatusMetadata = (item: InventoryItem) => {
  if (item.status === "OUT_OF_STOCK") return { label: "Out of stock", bg: "#FEE2E2", text: "#B91C1C" };
  if (item.status === "LOW_STOCK") return { label: "Low stock", bg: "#FFF7ED", text: "#92400E" };
  if (item.reservedStock > 0) return { label: "Reserved", bg: "#EFF6FF", text: "#1D4ED8" };
  return { label: "In stock", bg: "#ECFDF5", text: "#166534" };
};

export default function InventoryTable({
  items,
  visibleCount,
  query,
  onQueryChange,
  warehouseFilter,
  onWarehouseFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  sortDirection,
  page,
  totalPages,
  pageSize,
  onSort,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  menuOpenId,
  onMenuToggle,
  warehouseOptions,
  categoryOptions,
}: {
  items: InventoryItem[];
  visibleCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  warehouseFilter: string;
  onWarehouseFilterChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  page: number;
  totalPages: number;
  pageSize: number;
  onSort: (key: SortKey) => void;
  onPageChange: (next: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearFilters: () => void;
  menuOpenId: number | null;
  onMenuToggle: (id: number | null) => void;
  warehouseOptions: string[];
  categoryOptions: string[];
}) {
  return (
    <div className="rounded-[18px] border border-[#E7EBF3] bg-white p-5 shadow-[0_14px_30px_-20px_rgba(9,30,66,0.18)]">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#0A1931] transition hover:border-[#2563EB]">Bulk Actions</button>
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#E7EBF3] bg-white px-4 text-sm font-semibold text-[#0A1931] transition hover:border-[#2563EB]">Export Selected</button>
          <button type="button" className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[#FEE2E2] bg-[#FEF2F2] px-4 text-sm font-semibold text-[#B91C1C] transition hover:bg-[#FEE2E2]">Delete Selected</button>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:w-[72%]">
          <label className="relative block w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search product, SKU or category"
              className="w-full rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] py-4 pl-12 pr-4 text-sm text-[#0A1931] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
          </label>
          <label className="flex items-center gap-3 rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-4 text-sm text-[#0A1931]">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">Warehouse</span>
            <select value={warehouseFilter} onChange={(event) => onWarehouseFilterChange(event.target.value)} className="w-full bg-transparent text-sm outline-none">
              <option value="all">All</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>{warehouse}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-4 text-sm text-[#0A1931]">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">Category</span>
            <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)} className="w-full bg-transparent text-sm outline-none">
              <option value="all">All</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-[16px] border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-4 text-sm text-[#0A1931]">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748B]">Status</span>
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} className="w-full bg-transparent text-sm outline-none">
              <option value="all">All</option>
              <option value="inStock">In stock</option>
              <option value="lowStock">Low stock</option>
              <option value="outOfStock">Out of stock</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#E7EBF3] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-white text-left text-[11px] uppercase tracking-[0.28em] text-[#64748B]">
              <tr className="border-b border-[#E7EBF3]">
                <th className="sticky left-0 z-30 w-14 bg-white px-4 py-4"><input type="checkbox" className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" /></th>
                <th className="w-[18%] px-4 py-4">Product</th>
                <th className="w-[9%] px-4 py-4">SKU</th>
                <th className="w-[10%] px-4 py-4">Category</th>
                <th className="w-[12%] px-4 py-4">Warehouse</th>
                <th className="w-[8%] px-4 py-4">Stock</th>
                <th className="w-[8%] px-4 py-4">Reserved</th>
                <th className="w-[8%] px-4 py-4">Available</th>
                <th className="w-[10%] px-4 py-4">Status</th>
                <th className="w-[11%] px-4 py-4">Updated</th>
                <th className="w-16 px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const available = Math.max(0, item.currentStock - item.reservedStock);
                const status = getStatusMetadata(item);
                return (
                  <tr key={item.id} className={`group border-b border-[#F1F5F9] ${index % 2 === 0 ? "bg-[#FCFCFE]" : "bg-white"} transition hover:bg-[#F8FAFC]`}>
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-4">
                      <input type="checkbox" className="h-4 w-4 rounded border-[#D4AF37] text-[#D4AF37] focus:ring-[#D4AF37]" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[14px] bg-[#F3F4F6]">
                          {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <span className="text-[10px] uppercase tracking-[0.28em] text-[#64748B]">IMG</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0A1931]">{item.name}</p>
                          <p className="text-xs text-[#64748B]">{item.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[#0A1931]">{item.sku}</td>
                    <td className="px-4 py-4 text-[#64748B]">{item.category}</td>
                    <td className="px-4 py-4 text-[#0A1931]">
                      <div className="inline-flex items-center gap-2 text-sm text-[#0A1931]">
                        <Warehouse className="h-4 w-4 text-[#D4AF37]" />
                        {item.warehouse}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#0A1931]">{item.currentStock}</td>
                    <td className="px-4 py-4 text-[#0A1931]">{item.reservedStock}</td>
                    <td className="px-4 py-4 text-[#0A1931]">{available}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ backgroundColor: status.bg, color: status.text }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[#64748B]">{formatDate(item.lastUpdated)}</td>
                    <td className="px-4 py-4 text-right">
                      <button type="button" onClick={() => onMenuToggle(menuOpenId === item.id ? null : item.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E7EBF3] bg-[#F8FAFC] text-[#0A1931] transition hover:border-[#2563EB]">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#64748B]">Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, visibleCount)} of {visibleCount} results</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E7EBF3] bg-[#F8FAFC] px-4 py-2 text-sm text-[#0A1931]">
            <span>Items per page</span>
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="appearance-none rounded-full border border-[#D4AF37] bg-white px-4 py-2 text-sm text-[#0A1931] outline-none">
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={16}>16</option>
            </select>
            <ChevronDown className="pointer-events-none h-3 w-3 text-[#64748B]" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E7EBF3] bg-white px-3 py-2 text-sm text-[#0A1931]">
            <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded-full px-3 py-2 text-sm font-semibold text-[#0A1931] disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-full px-3 py-2 text-sm font-semibold text-[#0A1931] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
