import React, { useEffect, useMemo, useState } from "react";
import { Wallet, ShoppingCart, Users, Boxes, BarChart2, FileText, Clock, Package } from "lucide-react";
import { adminApiFetch } from "@/lib/admin-api";
import { useAdminContext } from "@/lib/admin-context";

async function fetchAdmin(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  const response = await adminApiFetch(`/api/admin${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || 'Admin request failed');
  return data;
}

function KpiCard({ kpi }: { kpi: { label: string; value: string | number; Icon?: any } }) {
  return (
    <div className="rounded-2xl bg-gradient-to-b from-white to-[#FBFBFB] p-8 shadow-[0_8px_30px_-12px_rgba(7,17,32,0.12)] hover:shadow-[0_18px_50px_-22px_rgba(7,17,32,0.18)] transform hover:-translate-y-1 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#FFF8E8] text-[#D4AF37] shadow-inner">
            {kpi.Icon ? <kpi.Icon className="h-6 w-6" /> : null}
          </div>
          <div>
            <div className="text-xs font-semibold text-[#64748B] uppercase tracking-widest">{kpi.label}</div>
            <div className="mt-1 text-3xl font-semibold leading-tight text-[#071120]">{kpi.value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: number | string | undefined) {
  const n = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatNumber(value: number | string | undefined) {
  const n = typeof value === 'number' ? value : Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('en-IN').format(n);
}

function LineChartPlaceholder({ series }: { series?: Array<{ name: string; revenue: number }> }) {
  if (!series || series.length === 0) {
    return <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]"><svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none"><polyline fill="none" stroke="#D4AF37" strokeWidth="2.5" points="0,120 80,90 160,80 240,70 320,60 400,58 480,56 560,52 600,50" /></svg></div>;
  }
  const max = Math.max(...series.map((item) => item.revenue || 0), 1);
  const points = series.map((item, idx) => {
    const x = idx === 0 ? 0 : Math.round((idx / Math.max(series.length - 1, 1)) * 600);
    const y = 160 - Math.round(((item.revenue || 0) / max) * 120);
    return `${x},${y}`;
  });
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]">
      <svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none">
        <polyline fill="none" stroke="#D4AF37" strokeWidth="2.5" points={points.join(' ')} />
      </svg>
    </div>
  );
}

function BarChartPlaceholder({ series }: { series?: Array<{ name: string; orders: number }> }) {
  if (!series || series.length === 0) {
    return <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]"><svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none"><rect x="30" y="60" width="36" height="80" rx="6" fill="#071120" opacity="0.9" /><rect x="110" y="40" width="36" height="100" rx="6" fill="#071120" opacity="0.8" /><rect x="190" y="20" width="36" height="120" rx="6" fill="#071120" opacity="0.7" /><rect x="270" y="30" width="36" height="110" rx="6" fill="#071120" opacity="0.75" /><rect x="350" y="50" width="36" height="90" rx="6" fill="#071120" opacity="0.85" /></svg></div>;
  }
  const max = Math.max(...series.map((item) => item.orders || 0), 1);
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]">
      <svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none">
        {series.map((item, idx) => {
          const barH = Math.max(8, Math.round(((item.orders || 0) / max) * 120));
          const x = 20 + idx * 90;
          const y = 150 - barH;
          return <rect key={item.name} x={x} y={y} width="40" height={barH} rx="6" fill="#071120" opacity="0.9" />;
        })}
      </svg>
    </div>
  );
}

function TableCard({ title, rows }: { title: string; rows: Array<Record<string, any>> }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_-12px_rgba(7,17,32,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#071120]">{title}</h3>
        <button className="text-sm text-[#64748B] hover:text-[#071120] transition-colors duration-150">View all</button>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r) => (
          <div key={r.title + (r.meta || '')} className="py-3 flex items-center justify-between hover:bg-[#FBFBFB] transition-colors duration-150">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-gray-50 flex items-center justify-center text-[#071120]">{r.icon || <Package />}</div>
              <div>
                <div className="text-sm font-medium text-slate-900">{r.title}</div>
                <div className="text-xs text-gray-400">{r.subtitle}</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">{r.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityTimeline({ items }: { items: Array<{ time: string; text: string; type?: string }> }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_-12px_rgba(7,17,32,0.06)]">
      <h3 className="text-sm font-semibold mb-3 text-[#071120]">Recent Activity</h3>
      <ol className="space-y-3">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <div className="mt-1 h-3 w-3 rounded-full bg-[#D4AF37]" />
            <div>
              <div className="text-sm text-slate-900">{it.text}</div>
              <div className="text-xs text-gray-400">{it.time}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Quick actions intentionally removed for a minimal, focused dashboard

export default function Dashboard() {
  const { selectedStoreSlug, setSelectedStoreSlug } = useAdminContext();
  const [data, setData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const headers = new Headers({ 'x-store-slug': selectedStoreSlug });
        const analyticsQuery = selectedBrandId ? `/analytics?brandId=${encodeURIComponent(selectedBrandId)}` : '/analytics';
        const [analytics, orders, inventoryLowStock, storeData, brandData] = await Promise.all([
          fetchAdmin(analyticsQuery, { headers }),
          fetchAdmin('/recent-orders?limit=5', { headers }).catch(() => []),
          fetchAdmin('/inventory/low-stock', { headers }).catch(() => []),
          fetchAdmin('/stores', { headers }).catch(() => []),
          fetchAdmin('/brands', { headers }).catch(() => []),
        ]);
        setData(analytics);
        setStores(Array.isArray(storeData) ? storeData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
        setRecentOrders((orders || []).map((order: any) => ({
          title: `Order #${order.id}`,
          subtitle: `${order.user?.name || order.user?.email || 'Customer'} — ${formatMoney(order.totalPrice)}`,
          meta: order.status || 'Order',
          icon: <ShoppingCart />,
        })));
        setLowStock((inventoryLowStock || []).slice(0, 5).map((row: any) => ({
          title: row.productName || 'Unknown product',
          subtitle: `${row.sku || 'Variant'} — ${row.quantityOnHand || 0} left`,
          meta: 'Low stock',
          icon: <Package />,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedStoreSlug, selectedBrandId]);

  const charts = data?.charts ?? {};

  const kpis = useMemo(() => {
    if (!data?.kpis) return [];
    return [
      { label: 'Total Revenue', value: formatMoney(data.kpis.totalRevenue), Icon: Wallet },
      { label: 'Orders', value: formatNumber(data.kpis.totalOrders), Icon: ShoppingCart },
      { label: 'Customers', value: formatNumber(data.kpis.totalCustomers), Icon: Users },
      { label: 'Inventory', value: formatMoney(data.kpis.totalInventoryValue || 0), Icon: Boxes },
    ];
  }, [data]);

  const revenueGrowth = Array.isArray(charts.revenueGrowth) ? charts.revenueGrowth : [];
  const ordersPerMonth = Array.isArray(charts.ordersPerMonth) ? charts.ordersPerMonth : [];
  const salesByCategory = Array.isArray(charts.salesByCategory) ? charts.salesByCategory : [];
  const topSellingProducts = Array.isArray(charts.topSellingProducts) ? charts.topSellingProducts : [];
  const inventoryLevels = charts.inventoryLevels ?? { totalStock: 0, lowStock: 0, outOfStock: 0, restockedToday: 0, averageStock: 0, byStatus: [], stockByProduct: [] };
  const inventoryDistribution = Array.isArray(charts.inventoryDistribution) ? charts.inventoryDistribution : [];
  const revenueVsProfit = Array.isArray(charts.revenueVsProfit) ? charts.revenueVsProfit : [];
  const customersByMonth = Array.isArray(charts.customersByMonth) ? charts.customersByMonth : [];

  const lowStockProducts = Array.isArray(data?.kpis?.lowStockProducts) ? data.kpis.lowStockProducts : [];

  const topSelling = useMemo(() => {
    return topSellingProducts.slice(0, 3).map((item: any) => ({
      title: item.name,
      subtitle: `${item.category || 'Category'} — ${item.units || 0} units`,
      meta: formatMoney(item.revenue),
      icon: <Package />,
    }));
  }, [topSellingProducts]);

  const recentCustomers = useMemo(() => {
    return [];
  }, []);

  const activities = [{ time: 'live', text: 'Dashboard synced from admin analytics backend' }];

  if (loading) return <div className="space-y-10"><section><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><KpiCard kpi={{ label: 'Loading', value: '…', Icon: BarChart2 }} /></div></section></div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No analytics data returned.</div>;

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_30px_-12px_rgba(7,17,32,0.08)]">
        <label className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
          Store
          <select className="ml-2 rounded-xl border border-[#E8DEC1] bg-[#FBF9F3] px-3 py-2 text-sm text-[#071120] outline-none" value={selectedStoreSlug} onChange={(event) => {
            setSelectedStoreSlug(event.target.value)
            setSelectedBrandId('')
          }}>
            <option value="house-of-valerion">House of Valerion — Parent</option>
            {stores.length ? stores.map((store: any) => (
              <option key={store.slug || store.id} value={store.slug || store.name}>{store.name || store.slug}</option>
            )) : <option value={selectedStoreSlug}>{selectedStoreSlug}</option>}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
          Brand
          <select className="ml-2 rounded-xl border border-[#E8DEC1] bg-[#FBF9F3] px-3 py-2 text-sm text-[#071120] outline-none" value={selectedBrandId} onChange={(event) => setSelectedBrandId(event.target.value)}>
            <option value="">All Brands</option>
            {brands.map((brand: any) => (
              <option key={brand.id} value={String(brand.id)}>{brand.name}</option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} kpi={k} />
          ))}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold mb-3">Revenue Trend</h3>
            <LineChartPlaceholder series={revenueGrowth} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Orders Trend</h3>
            <BarChartPlaceholder series={ordersPerMonth} />
          </div>
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableCard title="Recent Orders" rows={recentOrders.length ? recentOrders : []} />
          <TableCard title="Recent Customers" rows={recentCustomers.length ? recentCustomers : []} />
          <TableCard title="Low Stock Products" rows={lowStock.length ? lowStock : []} />
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableCard title="Top Selling Products" rows={topSelling.length ? topSelling : []} />
          <ActivityTimeline items={activities} />
          <div />
        </div>
      </section>
    </div>
  );
}
