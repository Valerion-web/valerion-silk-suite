import { ReactNode } from "react";
import clsx from "clsx";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "gold";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[#F8FAFC] text-[#0F172A] border border-[#E5E7EB]",
  success: "bg-[#ECFDF5] text-[#166534] border border-[#D1FAE5]",
  warning: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
  danger: "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]",
  gold: "bg-[#FFF8E8] text-[#C8A13B] border border-[#FDE68A]",
};

export default function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em]", variantStyles[variant], className)}>
      {children}
    </span>
  );
}
