import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const styles: Record<ButtonVariant, string> = {
  primary: "bg-[#C8A13B] text-white hover:bg-[#b18f33]",
  secondary: "bg-white text-[#0F172A] border border-[#E5E7EB] hover:bg-[#F8F8F8]",
  danger: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
  ghost: "bg-transparent text-[#0F172A] hover:bg-[#F8F8F8]",
};

export default function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex h-12 items-center justify-center rounded-[14px] px-5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#C8A13B]/30",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
