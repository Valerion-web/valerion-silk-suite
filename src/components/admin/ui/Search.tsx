import { useId } from "react";
import { Search } from "lucide-react";

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Search" }: SearchProps) {
  const id = useId();
  return (
    <label htmlFor={id} className="relative block w-full text-sm text-[#0F172A]">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-[#E5E7EB] bg-white px-12 py-3 text-sm text-[#0F172A] outline-none transition duration-200 focus:border-[#C8A13B] focus:ring-2 focus:ring-[#C8A13B]/20"
      />
    </label>
  );
}
