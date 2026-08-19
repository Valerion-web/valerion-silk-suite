import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";
import ChartCard from "./ChartCard";
import type { MovementDatum } from "./types";

const chartTooltipStyle = {
  backgroundColor: "#041E42",
  border: "1px solid rgba(212,175,55,0.15)",
  borderRadius: 12,
  color: "#FCFAF4",
  fontSize: 12,
};

export default function MovementChart({ data }: { data: MovementDatum[] }) {
  return (
    <ChartCard title="Inventory Movement" subtitle="Stock flow" badge="Monthly update" badgeVariant="soft">
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F2E7CB" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="added" stackId="inventory" fill="#22C55E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="sold" stackId="inventory" fill="#041E42" radius={[4, 4, 0, 0]} />
            <Bar dataKey="returned" stackId="inventory" fill="#D4AF37" radius={[4, 4, 0, 0]} />
            <Bar dataKey="adjusted" stackId="inventory" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
