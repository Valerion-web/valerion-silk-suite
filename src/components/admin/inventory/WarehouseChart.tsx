import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";
import ChartCard from "./ChartCard";
import type { WarehouseDatum } from "./types";

const chartTooltipStyle = {
  backgroundColor: "#041E42",
  border: "1px solid rgba(212,175,55,0.15)",
  borderRadius: 12,
  color: "#FCFAF4",
  fontSize: 12,
};

export default function WarehouseChart({ data }: { data: WarehouseDatum[] }) {
  return (
    <ChartCard title="Stock by Warehouse" subtitle="Warehouse distribution" badge="Warehouse mix" badgeVariant="gold">
      <div className="space-y-4">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 14, right: 10, left: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} vertical={false} stroke="#F2E7CB" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fill: "#111827", fontSize: 12, fontWeight: 600 }} />
              <Tooltip formatter={(value: number) => [`${value} units`, "Units"]} contentStyle={chartTooltipStyle} />
              <Bar dataKey="value" radius={[0, 12, 12, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.map((entry) => (
            <div key={entry.name} className="rounded-[16px] border border-[#F0E5BB] bg-[#FFFBF6] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <p className="font-semibold text-[#041E42]">{entry.name}</p>
                </div>
                <p className="text-sm font-semibold text-[#041E42]">{entry.percent}%</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#EAE2C7]">
                <div className="h-full rounded-full bg-current" style={{ width: `${entry.percent}%`, backgroundColor: entry.color }} />
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{entry.value} units</p>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
