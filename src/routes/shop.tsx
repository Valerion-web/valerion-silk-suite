import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Flame, Star, X, Check } from "lucide-react";
import { products } from "@/lib/products";
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

const FABRICS = ["Italian Wool", "Egyptian Cotton", "Cashmere", "Silk", "Linen", "Cotton Velour", "Velvet", "Satin"];
const FITS = ["Slim", "Tailored", "Regular", "Oversized"];
const COLOR_OPTIONS = [
  { name: "Navy", hex: "#0A1931" },
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#F8FAFC" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Beige", hex: "#C9B99A" },
  { name: "Charcoal", hex: "#2D2D2D" },
];
const QUICK = [
  { id: "new", label: "New Arrivals", icon: Sparkles },
  { id: "best", label: "Best Sellers", icon: Flame },
  { id: "featured", label: "Featured", icon: Star },
  { id: "limited", label: "Limited Edition", icon: Sparkles },
];

type Filters = {
  category: string;
  size: string | null;
  color: string | null;
  maxPrice: number;
  fabric: string | null;
  fit: string | null;
  inStock: boolean;
  quick: string | null;
  rating: number;
};

const DEFAULTS: Filters = {
  category: "All",
  size: null,
  color: null,
  maxPrice: 4000,
  fabric: null,
  fit: null,
  inStock: false,
  quick: null,
  rating: 0,
};

function ShopPage() {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [sort, setSort] = useState("Featured");
  const [open, setOpen] = useState(false);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((s) => ({ ...s, [k]: v }));

  const filtered = useMemo(() => {
    let list = products.slice();
    if (f.category !== "All") list = list.filter((p) => p.category === f.category);
    if (f.size) list = list.filter((p) => p.sizes.includes(f.size!));
    if (f.color) list = list.filter((p) => p.colors.some((c) => c.toLowerCase() === f.color!.toLowerCase()));
    list = list.filter((p) => p.price <= f.maxPrice);
    if (f.fabric) list = list.filter((p) => p.fabric.toLowerCase().includes(f.fabric!.toLowerCase()));
    if (f.quick === "new") list = list.filter((p) => p.badge === "New");
    if (f.quick === "best") list = list.filter((p) => p.badge === "Bestseller");
    if (f.quick === "featured" || f.quick === "limited") list = list.filter((p) => p.badge === "Limited");
    if (sort === "Price: Low") list.sort((a, b) => a.price - b.price);
    if (sort === "Price: High") list.sort((a, b) => b.price - a.price);
    return list;
  }, [f, sort]);

  const activeCount =
    (f.category !== "All" ? 1 : 0) +
    (f.size ? 1 : 0) +
    (f.color ? 1 : 0) +
    (f.fabric ? 1 : 0) +
    (f.fit ? 1 : 0) +
    (f.rating ? 1 : 0) +
    (f.inStock ? 1 : 0) +
    (f.quick ? 1 : 0) +
    (f.maxPrice < 4000 ? 1 : 0);

  return (
    <>
      <PageHeader eyebrow="The Edit" title="Shop the Collection" subtitle="Every piece, considered. Every fabric, exceptional." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-12">
          {/* COLLECTIONS IN HOUSE — compact luxury dropdown */}
          <div className="relative mb-10 max-w-xl">
            <button
              onClick={() => setOpen((o) => !o)}
              className={`w-full flex items-center justify-between gap-4 px-5 py-3.5 border transition-all duration-500 ${
                open ? "border-gold shadow-[0_0_24px_rgba(212,175,55,0.2)]" : "border-gold/30 hover:border-gold/60"
              } bg-midnight/5 backdrop-blur-md`}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] tracking-wider-luxury text-gold/80">⌖</span>
                <p className="font-display text-sm md:text-base tracking-[0.18em]">COLLECTIONS IN HOUSE</p>
              </div>
              <div className="flex items-center gap-3">
                {activeCount > 0 && (
                  <span className="text-[9px] tracking-luxury uppercase text-gold">{activeCount}</span>
                )}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.4 }}>
                  <ChevronDown className="h-4 w-4 text-gold" />
                </motion.span>
              </div>
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute z-30 left-0 right-0 mt-2 origin-top"
                >
                  <div className="border border-gold/40 bg-background/90 backdrop-blur-2xl shadow-[0_24px_60px_-20px_rgba(212,175,55,0.25)]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 p-5 md:p-6">
                      <Group title="Fabric">
                        <div className="flex flex-wrap gap-1.5">
                          {FABRICS.map((fb) => (
                            <Chip key={fb} active={f.fabric === fb} onClick={() => set("fabric", f.fabric === fb ? null : fb)}>{fb}</Chip>
                          ))}
                        </div>
                      </Group>

                      <Group title="Fit">
                        <div className="flex flex-wrap gap-1.5">
                          {FITS.map((fit) => (
                            <Chip key={fit} active={f.fit === fit} onClick={() => set("fit", f.fit === fit ? null : fit)}>{fit}</Chip>
                          ))}
                        </div>
                      </Group>

                      <Group title="Color">
                        <div className="flex flex-wrap gap-2">
                          {COLOR_OPTIONS.map((c) => (
                            <button
                              key={c.hex}
                              onClick={() => set("color", f.color === c.hex ? null : c.hex)}
                              className={`h-7 w-7 rounded-full border transition-all ${f.color === c.hex ? "border-gold ring-2 ring-gold/30" : "border-border hover:border-foreground"}`}
                              style={{ backgroundColor: c.hex }}
                              aria-label={c.name}
                            />
                          ))}
                        </div>
                      </Group>

                      <Group title="Rating">
                        <div className="flex gap-1">
                          {[1,2,3,4,5].map((n) => (
                            <button key={n} onClick={() => set("rating", f.rating === n ? 0 : n)} aria-label={`${n} stars`}>
                              <Star className={`h-4 w-4 ${n <= f.rating ? "fill-gold text-gold" : "text-muted-foreground"}`} />
                            </button>
                          ))}
                        </div>
                      </Group>

                      <Group title="Availability">
                        <div className="flex gap-1.5">
                          <Chip active={f.inStock} onClick={() => set("inStock", !f.inStock)}>In Stock</Chip>
                        </div>
                      </Group>

                      <Group title="Featured">
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK.map((q) => (
                            <Chip key={q.id} active={f.quick === q.id} onClick={() => set("quick", f.quick === q.id ? null : q.id)}>{q.label}</Chip>
                          ))}
                        </div>
                      </Group>
                    </div>

                    <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-3 border-t border-gold/15 bg-midnight/[0.03]">
                      <button
                        onClick={() => setF(DEFAULTS)}
                        className="inline-flex items-center gap-1.5 text-[10px] tracking-luxury uppercase text-muted-foreground hover:text-gold transition-colors"
                      >
                        <X className="h-3 w-3" /> Reset
                      </button>
                      <button
                        onClick={() => setOpen(false)}
                        className="inline-flex items-center gap-1.5 bg-gold text-midnight px-4 py-2 text-[10px] tracking-luxury uppercase hover:shadow-glow transition-all"
                      >
                        <Check className="h-3 w-3" /> View {filtered.length}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between mb-10 gap-4 pb-6 border-b border-border">
            <p className="text-[11px] tracking-luxury uppercase text-muted-foreground">
              <span className="text-foreground">{filtered.length}</span> pieces · New Arrivals
            </p>
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

          {filtered.length === 0 ? (
            <p className="font-serif italic text-muted-foreground text-center py-32">No pieces match these refinements.</p>
          ) : (
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] tracking-luxury uppercase text-gold mb-2.5 pb-2 border-b border-gold/15">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-7 border text-[10px] tracking-luxury uppercase transition-all ${active ? "border-gold bg-gold text-midnight" : "border-border hover:border-gold hover:text-gold"}`}
    >
      {children}
    </button>
  );
}
