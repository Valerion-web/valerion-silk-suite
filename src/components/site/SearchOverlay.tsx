import { motion } from "framer-motion";
import { Search, X, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { products, type Product } from "@/lib/products";

const trendingSuggestions = [
  "Tailored Suits",
  "Royal Blazer",
  "Premium Shirts",
  "Tuxedo",
  "Knitwear",
];

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmedQuery = query.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    if (!trimmedQuery) return [];
    return products.filter((product) =>
      product.name.toLowerCase().includes(trimmedQuery) ||
      product.category.toLowerCase().includes(trimmedQuery)
    );
  }, [trimmedQuery]);

  const handleResultClick = (product: Product) => {
    onClose();
    navigate(`/product/${product.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSuggestionClick = (value: string) => {
    setQuery(value);
    inputRef.current?.focus();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[60] bg-[rgba(248,248,250,0.92)] flex items-start justify-center px-4 pt-[110px] pb-10 sm:px-6 md:px-10"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto w-[90%] max-w-md md:max-w-[1000px] mx-auto overflow-hidden rounded-[34px] bg-white shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-frost/15 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-7">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-frost/80 hover:text-gold transition-colors"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="text-sm uppercase tracking-[0.45em] text-gold/80 mb-4">Search the House</p>
          <div className="search-overlay-panel flex items-center gap-4 rounded-[24px] border border-[rgba(212,175,55,0.3)] bg-[#07112e] px-4 py-4 shadow-glow transition-all duration-300">
            <Search className="h-5 w-5 text-[#d4af37]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for suits, shirts, knitwear…"
              className="search-overlay-input flex-1 w-full h-14 sm:h-16 px-5 text-lg sm:text-2xl truncate overflow-hidden whitespace-nowrap text-[#d4af37] font-display bg-transparent placeholder:text-sm sm:placeholder:text-xl placeholder:text-[#d4af37]/70 outline-none transition-all duration-300 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20"
              autoFocus
            />
          </div>
        </div>

        <div className="px-6 py-6 md:px-8 md:py-8 bg-[#f8f8fa]">
          {trimmedQuery ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-frost/60">
                <span>Search results for</span>
                <span className="rounded-full border border-frost/20 bg-frost/5 px-3 py-1 text-frost">{query}</span>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="space-y-4 max-h-[56vh] overflow-y-auto pr-1">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleResultClick(product)}
                      className="group w-full overflow-hidden rounded-[28px] border border-border bg-white p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-[#f8f8fa]"
                    >
                      <div className="grid grid-cols-[96px_1fr] gap-4 md:gap-6">
                        <div className="relative overflow-hidden rounded-3xl bg-frost/5">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex flex-col justify-between py-1">
                          <div>
                            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">{product.category}</p>
                            <h3 className="mt-2 text-xl font-semibold text-[#111827] transition-colors group-hover:text-gold">{product.name}</h3>
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-3 text-frost/70">
                            <span className="text-lg font-medium">${product.price.toLocaleString()}</span>
                            <ArrowRight className="h-5 w-5 text-frost/60 transition-all duration-300 group-hover:text-gold" />
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[28px] border border-border bg-white px-6 py-12 text-center text-[#111827]">
                  <p className="text-lg font-semibold text-[#111827] mb-3">No pieces found in the House.</p>
                  <p className="max-w-xl mx-auto text-sm leading-7 text-muted-foreground">
                    Try another word or browse the House’s collections to discover tailored suits, premium shirts, tuxedos, and knitwear.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-sm uppercase tracking-[0.45em] text-frost/50">Trending searches</div>
              <div className="flex flex-wrap gap-3">
                {trendingSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-full border border-border bg-white px-5 py-3 text-sm uppercase tracking-wider text-[#111827] transition-all duration-300 hover:border-gold hover:bg-[#f4f4f7] hover:text-[#111827]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="rounded-[28px] border border-border bg-white px-6 py-8 text-[#111827]">
                <p className="text-lg font-semibold text-[#111827] mb-2">Begin typing to reveal the House’s finest pieces.</p>
                <p className="text-sm leading-7 text-muted-foreground">Search by product name or category and the results will appear instantly below.</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default SearchOverlay;
