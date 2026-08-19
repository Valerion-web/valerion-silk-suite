import React from "react";
import { Search } from "lucide-react";

export default function SearchBox() {
  return (
    <div className="relative">
      <input
        placeholder="Search products, orders, customers..."
        className="w-full rounded-[16px] border border-gray-200 bg-white px-4 py-3 pl-12 text-sm shadow-sm focus:outline-none"
        aria-label="Search"
      />
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Search className="h-5 w-5" />
      </div>
    </div>
  );
}
