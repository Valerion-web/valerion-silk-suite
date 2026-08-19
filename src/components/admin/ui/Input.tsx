import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, className = "", ...props }, ref) => {
  return (
    <label className="block text-sm text-[#0F172A]">
      {label ? <span className="mb-2 block text-[#334155]">{label}</span> : null}
      <input
        ref={ref}
        className={clsx(
          "w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#0F172A] outline-none transition duration-200 focus:border-[#C8A13B] focus:ring-2 focus:ring-[#C8A13B]/20",
          className
        )}
        {...props}
      />
    </label>
  );
});

Input.displayName = "Input";

export default Input;
