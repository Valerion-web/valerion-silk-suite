import { ReactNode } from "react";

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, pageCount, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#334155]">
      <span>
        Page {currentPage} of {pageCount}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-full border border-[#D1D5DB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${page === currentPage ? "bg-[#C8A13B] text-white" : "bg-white text-[#0F172A] border border-[#E5E7EB] hover:bg-[#F8FAFC]"}`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage === pageCount}
          className="rounded-full border border-[#D1D5DB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
