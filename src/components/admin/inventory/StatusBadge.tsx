type StatusBadgeProps = {
  label: string;
  count: number;
};

const badgeStyles: Record<string, string> = {
  "In Stock": "bg-[#EFF6FF] text-[#1E3A8A] border-[#DDE5FF]",
  "Low Stock": "bg-[#FFF7ED] text-[#92400E] border-[#F7D2A6]",
  "Out of Stock": "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  Reserved: "bg-[#EFF6FF] text-[#1E3A8A] border-[#DDE5FF]",
};

export default function StatusBadge({ label, count }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${badgeStyles[label] ?? "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]"}`}>
      <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80" />
      {label} {count}
    </span>
  );
}
