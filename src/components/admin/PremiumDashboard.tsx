import React from "react";
import { Wallet, ShoppingCart, Users, Boxes, BarChart2, FileText, Clock, Package } from "lucide-react";

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

function LineChartPlaceholder() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]">
      <svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="url(#g1)" stroke="#D4AF37" strokeWidth="2.5" points="0,120 80,90 160,80 240,70 320,60 400,58 480,56 560,52 600,50" />
      </svg>
    </div>
  );
}

function BarChartPlaceholder() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_-14px_rgba(7,17,32,0.08)]">
      <svg className="w-full h-40" viewBox="0 0 600 160" preserveAspectRatio="none">
        <rect x="30" y="60" width="36" height="80" rx="6" fill="#071120" opacity="0.9" />
        <rect x="110" y="40" width="36" height="100" rx="6" fill="#071120" opacity="0.8" />
        <rect x="190" y="20" width="36" height="120" rx="6" fill="#071120" opacity="0.7" />
        <rect x="270" y="30" width="36" height="110" rx="6" fill="#071120" opacity="0.75" />
        <rect x="350" y="50" width="36" height="90" rx="6" fill="#071120" opacity="0.85" />
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
  const kpis = [
    { label: "Total Revenue", value: "₹1.24Cr", Icon: Wallet },
    { label: "Orders", value: 842, Icon: ShoppingCart },
    { label: "Customers", value: 1840, Icon: Users },
    { label: "Inventory", value: 1240, Icon: Boxes },
  ];

  const recentOrders = [
    { title: "Order #1004", subtitle: "2 items — ₹16,420", meta: "Delivered", icon: <ShoppingCart /> },
    { title: "Order #1003", subtitle: "1 item — ₹9,450", meta: "Processing", icon: <ShoppingCart /> },
    { title: "Order #1002", subtitle: "3 items — ₹12,450", meta: "Pending", icon: <ShoppingCart /> },
  ];

  const lowStock = [
    { title: "Regent Blazer", subtitle: "Blazers — 4 left", meta: "Low stock", icon: <Package /> },
    { title: "Signature Loafer", subtitle: "Footwear — 3 left", meta: "Low stock", icon: <Package /> },
  ];

  const topSelling = [
    { title: "Peak-Lapel Tuxedo", subtitle: "Suits — 240 units", meta: "Top seller", icon: <Package /> },
    { title: "Silk Draped Shirt", subtitle: "Shirts — 190 units", meta: "Top seller", icon: <Package /> },
  ];

  const recentCustomers = [
    { title: "Mina Ribeiro", subtitle: "Joined 2d ago", meta: "₹12,400" },
    { title: "Liam O'Connor", subtitle: "Joined 5d ago", meta: "₹4,200" },
    { title: "Hiro Tanaka", subtitle: "Joined 1w ago", meta: "₹8,900" },
  ];

  const activities = [
    { time: "2m ago", text: "Product 'Regent Blazer' added" },
    { time: "10m ago", text: "Order #1005 placed" },
    { time: "1h ago", text: "Inventory updated for 'Signature Loafer'" },
    { time: "3h ago", text: "Customer 'Mina Ribeiro' registered" },
  ];

  return (
    <div className="space-y-10">
      {/* KPI row — primary focus */}
      <section>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} kpi={k} />
          ))}
        </div>
      </section>

      {/* Charts — limited to two meaningful visuals */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold mb-3">Revenue Trend</h3>
            <LineChartPlaceholder />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Orders Trend</h3>
            <BarChartPlaceholder />
          </div>
        </div>
      </section>

      {/* Operations — clear, purpose-driven widgets */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableCard title="Recent Orders" rows={recentOrders} />
          <TableCard title="Recent Customers" rows={recentCustomers} />
          <TableCard title="Low Stock Products" rows={lowStock} />
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableCard title="Top Selling Products" rows={topSelling} />
          <ActivityTimeline items={activities} />
          <div />
        </div>
      </section>
    </div>
  );
}
