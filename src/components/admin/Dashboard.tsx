import React from "react";
import { Wallet, ShoppingCart, Users, Boxes, BarChart2, Plus, FileText, Clock } from "lucide-react";

function KpiCard({ kpi }: { kpi: { label: string; value: string | number; trend?: string; subtitle?: string; Icon?: any } }) {
  return (
    <div className="rounded-[22px] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 text-[#D4AF37]">
            {kpi.Icon ? <kpi.Icon className="h-6 w-6" /> : null}
          </div>
          <div>
            <div className="text-sm text-gray-500">{kpi.label}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{kpi.value}</div>
          </div>
        </div>
        {kpi.trend ? (
          <div className="text-sm text-green-600">{kpi.trend}</div>
        ) : null}
      </div>
      {kpi.subtitle ? <div className="mt-3 text-xs text-gray-400">{kpi.subtitle}</div> : null}
    </div>
  );
}

function LineChartPlaceholder() {
  return (
    <div className="h-64 w-full rounded-[12px] bg-gradient-to-b from-white to-gray-50 p-4">
      <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
        <polyline fill="none" stroke="#D4AF37" strokeWidth="3" points="0,180 80,140 160,130 240,110 320,90 400,80 480,70 560,60 600,58" />
      </svg>
    </div>
  );
}

function BarChartPlaceholder() {
  return (
    <div className="h-64 w-full rounded-[12px] bg-gradient-to-b from-white to-gray-50 p-4">
      <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
        <rect x="30" y="120" width="40" height="100" rx="6" fill="#2458D3" />
        <rect x="110" y="100" width="40" height="120" rx="6" fill="#2458D3" />
        <rect x="190" y="80" width="40" height="140" rx="6" fill="#2458D3" />
        <rect x="270" y="60" width="40" height="160" rx="6" fill="#2458D3" />
        <rect x="350" y="90" width="40" height="130" rx="6" fill="#2458D3" />
      </svg>
    </div>
  );
}

function TableCard({ title, rows }: { title: string; rows: Array<Record<string, any>> }) {
  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button className="text-sm text-slate-600 hover:text-slate-800">View all</button>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map((r, i) => (
          <div key={i} className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-gray-50 flex items-center justify-center text-[#2458D3]">{r.icon || <Package />}</div>
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
    <div className="rounded-[22px] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
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

function QuickActions() {
  const actions = [
    { label: "Add Product", Icon: Plus },
    { label: "Create Order", Icon: ShoppingCart },
    { label: "Add Customer", Icon: Users },
    { label: "Generate Report", Icon: FileText },
  ];

  return (
    <div className="rounded-[22px] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {actions.map((a) => (
          <button key={a.label} className="flex items-center gap-2 rounded-[16px] border border-gray-100 bg-white px-4 py-2 text-sm hover:shadow">
            <a.Icon className="h-4 w-4 text-[#071120]" />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const kpis = [
    { label: "Total Revenue", value: "₹1.24Cr", trend: "+4.6%", subtitle: "Monthly revenue", Icon: Wallet },
    { label: "Orders", value: 842, trend: "+1.2%", subtitle: "This month", Icon: ShoppingCart },
    { label: "Customers", value: 1840, trend: "+2.1%", subtitle: "Active customers", Icon: Users },
    { label: "Inventory", value: 1240, trend: "-0.7%", subtitle: "Units in stock", Icon: Boxes },
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

  const activities = [
    { time: "2m ago", text: "Product 'Regent Blazer' added" },
    { time: "10m ago", text: "Order #1005 placed" },
    { time: "1h ago", text: "Inventory updated for 'Signature Loafer'" },
    { time: "3h ago", text: "Customer 'Mina Ribeiro' registered" },
  ];

  return (
    <div className="space-y-8">
      {/* Section 1 — Overview */}
      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} kpi={k} />
          ))}
        </div>
      </section>

      {/* Section 2 — Business Analytics */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Revenue Trend</h3>
            <LineChartPlaceholder />
          </div>

          <div className="rounded-[22px] bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Orders Trend</h3>
            <BarChartPlaceholder />
          </div>
        </div>
      </section>

      {/* Section 3 — Operations */}
      <section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TableCard title="Recent Orders" rows={recentOrders} />
          <TableCard title="Low Stock Products" rows={lowStock} />
          <TableCard title="Top Selling Products" rows={topSelling} />
        </div>
      </section>

      {/* Section 4 — Activity */}
      <section>
        <ActivityTimeline items={activities} />
      </section>

      {/* Section 5 — Quick Actions */}
      <section>
        <QuickActions />
      </section>
    </div>
  );
}
