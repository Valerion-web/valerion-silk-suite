import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import MiniSparkline from "./MiniSparkline";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  subtitle: string;
  percentage: string;
  color: string;
  sparkline: number[];
};

export default function StatCard({ icon: Icon, label, value, subtitle, percentage, color, sparkline }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
      className="group rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_20px_45px_-28px_rgba(4,30,66,0.18)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F2EA] text-[#041E42] shadow-sm" style={{ color }}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="rounded-full border border-[#F0E5BB] bg-[#FFFBF3] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#856C2F]">
          {percentage}
        </span>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280]">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-[#041E42]">{value}</p>
        <p className="text-sm text-[#6B7280]">{subtitle}</p>
      </div>

      <div className="mt-6 h-14">
        <MiniSparkline values={sparkline} color={color} />
      </div>
    </motion.div>
  );
}
