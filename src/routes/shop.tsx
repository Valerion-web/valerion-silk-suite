import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, X, Sparkles, Flame, Star } from "lucide-react";
import { categories, products, sizes, productColors } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageShell, PageHeader } from "@/components/site/PageShell";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — House of Valerion" },
      { name: "description", content: "The complete edit of luxury menswear. Tailored suits, premium shirts, knitwear and street luxury." },
      { property: "og:title", content: "Shop — House of Valerion" },
    ],
  }),
  component: ShopPage,
});

const FABRICS = ["Italian Wool", "Cashmere", "Egyptian Cotton", "Silk", "Cotton Velour"];
const FITS = ["Slim", "Tailored", "Regular", "Oversized"];
const QUICK = [
  { id: "new", label: "New Arrivals", icon: Sparkles },
  { id: "best", label: "Best Sellers", icon: Flame },
  { id: "featured", label: "Featured", icon: Star },
];

function ShopPage() {
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [sort, setSort] = useState("Featured");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(4000);
  const [fabric, setFabric] = useState<string | null>(null);
  const [fit, setFit] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);
  const [quick, setQuick] = useState<string | null>(null);
  const [rating, setRating] = useState(0);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (size) list = list.filter((p) => p.sizes.includes(size));
    if (color) list = list.filter((p) => p.colors.some((c) => c.toLowerCase() === color.toLowerCase()));
    list = list.filter((p) => p.price <= maxPrice);
    if (fabric) list = list.filter((p) => p.fabric.toLowerCase().includes(fabric.toLowerCase()));
    if (quick === "new") list = list.filter((p) => p.badge === "New");
    if (quick === "best") list = list.filter((p) => p.badge === "Bestseller");
    if (quick === "featured") list = list.filter((p) => p.badge === "Limited");
    if (sort === "Price: Low") list.sort((a, b) => a.price - b.price);
    if (sort === "Price: High") list.sort((a, b) => b.price - a.price);
    return list;
  }, [category, size, color, sort, maxPrice, fabric, quick]);

  const filterProps = { category, setCategory, size, setSize, color, setColor, maxPrice, setMaxPrice, fabric, setFabric, fit, setFit, inStock, setInStock, quick, setQuick, rating, setRating };

  return (
    <>
      <PageHeader eyebrow="The Edit" title="Shop the Collection" subtitle="Every piece, considered. Every fabric, exceptional." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-16">
          {/* Quick filter chips */}
          <div className="flex flex-wrap items-center gap-3 mb-10 pb-8 border-b border-border">
            {QUICK.map((q) => {
              const Icon = q.icon;
              const active = quick === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setQuick(active ? null : q.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-[10px] tracking-luxury uppercase border transition-all ${
                    active ? "bg-gold border-gold text-midnight shadow-glow" : "border-border hover:border-gold hover:text-gold"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {q.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-10 gap-4">
            <button onClick={() => setFiltersOpen(true)} className="lg:hidden inline-flex items-center gap-2 text-[11px] tracking-luxury uppercase border border-border px-4 py-2">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <p className="text-[11px] tracking-luxury uppercase text-muted-foreground hidden lg:block">{filtered.length} Pieces</p>
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-[10px] tracking-luxury uppercase text-muted-foreground hidden md:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent border border-border px-4 py-2 text-[11px] tracking-luxury uppercase outline-none focus:border-gold"
              >
                <option>Featured</option>
                <option>Price: Low</option>
                <option>Price: High</option>
              </select>
            </div>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-12">
            <aside className="hidden lg:block">
              <Filters {...filterProps} />
            </aside>

            <div>
              {filtered.length === 0 ? (
                <p className="font-serif italic text-muted-foreground text-center py-32">No pieces match these refinements.</p>
              ) : (
                <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {filtersOpen && (
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} className="fixed inset-0 z-50 bg-background p-8 overflow-y-auto lg:hidden">
            <div className="flex justify-between items-center mb-8">
              <span className="font-display text-2xl">Filters</span>
              <button onClick={() => setFiltersOpen(false)}><X /></button>
            </div>
            <Filters {...filterProps} />
          </motion.div>
        )}
      </PageShell>
    </>
  );
}

type FProps = {
  category: string; setCategory: (v: string) => void;
  size: string | null; setSize: (v: string | null) => void;
  color: string | null; setColor: (v: string | null) => void;
  maxPrice: number; setMaxPrice: (v: number) => void;
  fabric: string | null; setFabric: (v: string | null) => void;
  fit: string | null; setFit: (v: string | null) => void;
  inStock: boolean; setInStock: (v: boolean) => void;
  quick: string | null; setQuick: (v: string | null) => void;
  rating: number; setRating: (v: number) => void;
};

function Filters(p: FProps) {
  return (
    <div className="space-y-10">
      <FilterGroup title="Category">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => p.setCategory(c)}
            className={`block text-left text-sm py-1 link-underline ${p.category === c ? "text-gold" : "text-foreground"}`}
          >
            {c}
          </button>
        ))}
      </FilterGroup>

      <FilterGroup title={`Price · up to $${p.maxPrice.toLocaleString()}`}>
        <input
          type="range"
          min={300}
          max={4000}
          step={50}
          value={p.maxPrice}
          onChange={(e) => p.setMaxPrice(Number(e.target.value))}
          className="w-full accent-[var(--gold)]"
        />
        <div className="flex justify-between text-[10px] tracking-luxury uppercase text-muted-foreground mt-2">
          <span>$300</span><span>$4,000</span>
        </div>
      </FilterGroup>

      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => p.setSize(p.size === s ? null : s)}
              className={`min-w-10 h-10 px-3 border text-xs tracking-luxury ${p.size === s ? "border-gold bg-gold text-midnight" : "border-border hover:border-foreground"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Color">
        <div className="flex flex-wrap gap-3">
          {productColors.map((c) => (
            <button
              key={c.hex}
              onClick={() => p.setColor(p.color === c.hex ? null : c.hex)}
              className={`h-9 w-9 rounded-full border-2 ${p.color === c.hex ? "border-gold ring-2 ring-gold/30" : "border-border"}`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Fabric">
        {FABRICS.map((f) => (
          <button
            key={f}
            onClick={() => p.setFabric(p.fabric === f ? null : f)}
            className={`block text-left text-sm py-1 link-underline ${p.fabric === f ? "text-gold" : "text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </FilterGroup>

      <FilterGroup title="Fit">
        <div className="flex flex-wrap gap-2">
          {FITS.map((f) => (
            <button
              key={f}
              onClick={() => p.setFit(p.fit === f ? null : f)}
              className={`px-3 h-9 border text-[10px] tracking-luxury uppercase ${p.fit === f ? "border-gold bg-gold text-midnight" : "border-border hover:border-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Rating">
        <div className="flex gap-1">
          {[1,2,3,4,5].map((n) => (
            <button key={n} onClick={() => p.setRating(p.rating === n ? 0 : n)} aria-label={`${n} stars`}>
              <Star className={`h-5 w-5 ${n <= p.rating ? "fill-gold text-gold" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <input type="checkbox" checked={p.inStock} onChange={(e) => p.setInStock(e.target.checked)} className="accent-[var(--gold)]" />
          In stock only
        </label>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] tracking-luxury uppercase text-gold mb-4 pb-3 border-b border-border">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
