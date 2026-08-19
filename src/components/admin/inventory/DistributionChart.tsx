import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import ChartCard from "./ChartCard";
import type { DistributionSegment } from "./types";

type DistributionChartProps = {
  items: DistributionSegment[];
  totalUnits: number;
  totalProducts: number;
  health: string;
};

export default function DistributionChart({ items, totalUnits, totalProducts, health }: DistributionChartProps) {
  return (
    <ChartCard title="Inventory Distribution" subtitle="Stock health" badge="Healthy inventory" badgeVariant="navy">
      <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[0.78fr_0.72fr] xl:items-center">
        <div className="relative flex min-h-[300px] items-center justify-center">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={items} dataKey="value" innerRadius={78} outerRadius={112} paddingAngle={2} stroke="none">
                {items.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} units`, "Units"]} contentStyle={{ backgroundColor: "#041E42", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 12, color: "#FCFAF4", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-full bg-white/90 text-center">
            <p className="text-3xl font-semibold tracking-tight text-[#041E42]">{totalUnits}</p>
            <p className="text-xs uppercase tracking-[0.3em] text-[#64748B]">TOTAL UNITS</p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="space-y-3">
            {items.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between gap-4 rounded-[16px] border border-[#F0E5BB] bg-[#FFFBF6] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <div>
                    <p className="text-sm font-semibold text-[#041E42]">{entry.name}</p>
                    <p className="text-sm text-[#6B7280]">{entry.value} units</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-[#041E42]">{entry.percent}%</p>
              </div>
            ))}
          </div>

          <div className="rounded-[16px] border border-[#F0E5BB] bg-[#FFFBF6] p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-[#6B7280]">Product Count</p>
            <p className="mt-2 text-3xl font-semibold text-[#041E42]">{totalProducts}</p>
            <p className="mt-4 text-sm text-[#64748B]">Inventory status is <span className="font-semibold text-[#041E42]">{health}</span>.</p>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
