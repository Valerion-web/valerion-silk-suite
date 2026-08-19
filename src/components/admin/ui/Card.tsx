import { ReactNode } from "react";

interface CardProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function Card({ title, subtitle, footer, className = "", children }: CardProps) {
  return (
    <section className={`rounded-[20px] border border-[#E5E7EB] bg-white p-6 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.14)] ${className}`}>
      {(title || subtitle) && (
        <div className="mb-5">
          {title ? <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">{title}</h2> : null}
          {subtitle ? <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p> : null}
        </div>
      )}
      <div className="space-y-4">{children}</div>
      {footer ? <div className="mt-6 border-t border-[#E5E7EB] pt-4">{footer}</div> : null}
    </section>
  );
}
