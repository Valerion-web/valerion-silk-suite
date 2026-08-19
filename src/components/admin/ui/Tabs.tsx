import { ReactNode } from "react";
import clsx from "clsx";

interface TabItem {
  value: string;
  label: string;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
}

export default function Tabs({ value, onChange, items }: TabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={clsx(
            "rounded-[14px] px-4 py-2 text-sm font-semibold transition",
            value === item.value
              ? "bg-[#D4AF37] text-white"
              : "bg-transparent text-[#64748B] hover:bg-[#F8F8F8]"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
