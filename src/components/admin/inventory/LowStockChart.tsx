import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from "recharts";
import ChartCard from "./ChartCard";
import type { TrendDatum } from "./types";

const chartTooltipStyle = {
  backgroundColor: "#041E42",
  border: "1px solid rgba(212,175,55,0.15)",
  borderRadius: 12,
  color: "#FCFAF4",
  fontSize: 12,
};

export default function LowStockChart({ data }: { data: TrendDatum[] }) {
  return (
    <ChartCard title="Low Stock Trend" subtitle="Critical alert" badge="Alert Watch" badgeVariant="red">
      <div className="h-[320px] rounded-[18px] bg-[#FFF4F3] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#FDE8E9" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <defs>
              <linearGradient id="lowStockGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#DC2626" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="#DC2626" strokeWidth={3} fill="url(#lowStockGradient)" dot={{ r: 4, fill: "#DC2626" }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
