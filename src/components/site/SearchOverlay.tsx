import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { useEffect } from "react";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[60] bg-midnight/95 backdrop-blur-2xl flex flex-col"
    >
      <button onClick={onClose} className="absolute top-6 right-6 text-frost hover:text-gold" aria-label="Close">
        <X className="h-6 w-6" />
      </button>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.6 }}
        className="m-auto w-full max-w-3xl px-6"
      >
        <p className="text-center text-gold text-[10px] tracking-wider-luxury uppercase mb-8">Search the House</p>
        <div className="flex items-center gap-4 border-b border-frost/30 pb-4">
          <Search className="h-5 w-5 text-frost/60" />
          <input
            autoFocus
            placeholder="Search for suits, shirts, knitwear…"
            className="flex-1 bg-transparent text-frost text-2xl md:text-4xl font-display placeholder:text-frost/30 outline-none"
          />
        </div>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          {["Tailored Suits", "Cashmere", "Royal Blazer", "Tuxedo", "Knitwear"].map((t) => (
            <button key={t} className="text-[11px] tracking-luxury uppercase text-frost/70 border border-frost/20 rounded-full px-4 py-2 hover:border-gold hover:text-gold transition-colors">
              {t}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
