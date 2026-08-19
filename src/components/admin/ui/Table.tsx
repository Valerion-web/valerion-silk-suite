import { ReactNode } from "react";
import clsx from "clsx";

interface TableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
}

export default function Table({ headers, children, className = "" }: TableProps) {
  return (
    <div className={clsx("overflow-x-auto rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.14)]", className)}>
      <table className="min-w-full text-left text-sm text-[#334155]">
        <thead className="bg-[#F8FAFC] text-[#64748B]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap px-6 py-4 font-semibold uppercase tracking-[0.18em]">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
