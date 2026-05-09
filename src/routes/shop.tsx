import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
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

function ShopPage() {
  const [category, setCategory] = useState("All");
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [sort, setSort] = useState("Featured");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (size) list = list.filter((p) => p.sizes.includes(size));
    if (color) list = list.filter((p) => p.colors.some((c) => c.toLowerCase() === color.toLowerCase()));
    if (sort === "Price: Low") list.sort((a, b) => a.price - b.price);
    if (sort === "Price: High") list.sort((a, b) => b.price - a.price);
    return list;
  }, [category, size, color, sort]);

  return (
    <>
      <PageHeader eyebrow="The Edit" title="Shop the Collection" subtitle="Every piece, considered. Every fabric, exceptional." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-16">
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

          <div className="grid lg:grid-cols-[260px_1fr] gap-10">
            <aside className="hidden lg:block">
              <Filters {...{ category, setCategory, size, setSize, color, setColor }} />
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
            <Filters {...{ category, setCategory, size, setSize, color, setColor }} />
          </motion.div>
        )}
      </PageShell>
    </>
  );
}

function Filters({
  category, setCategory, size, setSize, color, setColor,
}: {
  category: string; setCategory: (v: string) => void;
  size: string | null; setSize: (v: string | null) => void;
  color: string | null; setColor: (v: string | null) => void;
}) {
  return (
    <div className="space-y-10">
      <FilterGroup title="Category">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`block text-left text-sm py-1 link-underline ${category === c ? "text-gold" : "text-foreground"}`}
          >
            {c}
          </button>
        ))}
      </FilterGroup>

      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(size === s ? null : s)}
              className={`min-w-10 h-10 px-3 border text-xs tracking-luxury ${size === s ? "border-gold bg-gold text-midnight" : "border-border hover:border-foreground"}`}
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
              onClick={() => setColor(color === c.hex ? null : c.hex)}
              className={`h-9 w-9 rounded-full border-2 ${color === c.hex ? "border-gold ring-2 ring-gold/30" : "border-border"}`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>
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
