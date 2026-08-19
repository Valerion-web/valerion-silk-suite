import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle: string;
  accent?: string;
  badge?: string;
  badgeVariant?: "gold" | "red" | "navy" | "soft";
  action?: ReactNode;
  children: ReactNode;
};

const badgeColors: Record<NonNullable<ChartCardProps["badgeVariant"]>, string> = {
  gold: "bg-[#FFF8E8] text-[#C9A227] border-[#F0E3B9]",
  red: "bg-[#FFF3F4] text-[#B91C1C] border-[#FBCACA]",
  navy: "bg-[#EDF0FF] text-[#24355A] border-[#D5D9F2]",
  soft: "bg-[#F8FAFC] text-[#4B5563] border-[#E8EAF2]",
};

export default function ChartCard({ title, subtitle, accent, badge, badgeVariant = "soft", action, children }: ChartCardProps) {
  return (
    <motion.section
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className="rounded-[18px] border border-[rgba(212,175,55,0.15)] bg-white p-6 shadow-[0_20px_45px_-28px_rgba(4,30,66,0.18)]"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#C9A227]">{subtitle}</p>
          <h3 className="mt-2 text-lg font-semibold text-[#041E42]">{title}</h3>
        </div>

        <div className="flex items-center gap-2">
          {badge ? (
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${badgeColors[badgeVariant]}`}>
              {badge}
            </span>
          ) : null}
          {action}
        </div>
      </div>

      <div className="min-h-[300px]">{children}</div>
    </motion.section>
  );
}
