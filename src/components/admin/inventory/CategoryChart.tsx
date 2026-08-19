import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import ChartCard from "./ChartCard";
import type { CategorySegment } from "./types";

const chartTooltipStyle = {
  backgroundColor: "#041E42",
  border: "1px solid rgba(212,175,55,0.15)",
  borderRadius: 12,
  color: "#FCFAF4",
  fontSize: 12,
};

export default function CategoryChart({ data }: { data: CategorySegment[] }) {
  return (
    <ChartCard title="Inventory by Category" subtitle="Category mix" badge="Category split" badgeVariant="soft">
      <div className="grid h-full grid-cols-1 gap-6 xl:grid-cols-[0.64fr_0.36fr] xl:items-center">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={52} outerRadius={88} paddingAngle={2} stroke="none">
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [`${value} SKUs`, "SKUs"]} contentStyle={chartTooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between rounded-[16px] border border-[#F0E5BB] bg-[#FFFBF6] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-medium text-[#041E42]">{entry.name}</span>
              </div>
              <span className="font-semibold text-[#041E42]">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
