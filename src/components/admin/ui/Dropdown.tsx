import { SelectHTMLAttributes } from "react";
import clsx from "clsx";

interface DropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export default function Dropdown({ label, className = "", children, ...props }: DropdownProps) {
  return (
    <label className="block text-sm text-[#0F172A]">
      {label ? <span className="mb-2 block text-[#334155]">{label}</span> : null}
      <select
        className={clsx(
          "w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#0F172A] outline-none transition duration-200 focus:border-[#C8A13B] focus:ring-2 focus:ring-[#C8A13B]/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
