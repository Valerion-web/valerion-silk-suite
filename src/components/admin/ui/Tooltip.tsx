import { ReactNode, useState } from "react";
import clsx from "clsx";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative inline-flex" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {children}
      {hovered ? (
        <div className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-[14px] border border-[#E5E7EB] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]">
          {content}
        </div>
      ) : null}
    </div>
  );
}
