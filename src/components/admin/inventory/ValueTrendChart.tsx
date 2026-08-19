import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";
import ChartCard from "./ChartCard";
import type { TrendDatum } from "./types";

const chartTooltipStyle = {
  backgroundColor: "#041E42",
  border: "1px solid rgba(212,175,55,0.15)",
  borderRadius: 12,
  color: "#FCFAF4",
  fontSize: 12,
};

export default function ValueTrendChart({ data }: { data: TrendDatum[] }) {
  return (
    <ChartCard title="Inventory Value Trend" subtitle="Value performance" badge="By month" badgeVariant="gold" action={<select className="rounded-full border border-[#E8DEC1] bg-[#FCFAF4] px-3 py-1.5 text-sm text-[#041E42] outline-none focus:border-[#C8A04D] focus:ring-2 focus:ring-[#C8A04D]/20"><option>Last 6 months</option><option>Last 12 months</option></select>}> 
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F2E7CB" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
            <Tooltip formatter={(value: number) => [new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value), "Value"]} contentStyle={chartTooltipStyle} />
            <defs>
              <linearGradient id="valueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: "#D4AF37" }} activeDot={{ r: 6 }} fill="url(#valueTrendGradient)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
