import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { products, collections } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageShell, PageHeader } from "@/components/site/PageShell";

// Mapping from category slugs (used in URLs) to product.category labels
const CATEGORY_MAP: Record<string, { title: string; matches: string[]; description: string }> = {
  "tailored-suits": { title: "Tailored Suits", matches: ["Tailored Suits", "Modern Formalwear"], description: "Sculpted silhouettes engineered for the gentleman who measures success in millimetres." },
  "premium-shirts": { title: "Premium Shirts", matches: ["Premium Shirts"], description: "Sea Island and Egyptian cotton, hand-finished placards, mother-of-pearl buttons." },
  "oversized-luxury": { title: "Oversized Luxury", matches: ["Oversized Luxury"], description: "Relaxed proportions in noble fabrics — quiet luxury redefined." },
  "modern-formalwear": { title: "Modern Formalwear", matches: ["Modern Formalwear", "Tailored Suits"], description: "Tuxedos and three-piece compositions for the most discerning evenings." },
  "knitwear-essentials": { title: "Knitwear Essentials", matches: ["Knitwear Essentials"], description: "Mongolian cashmere and silk-cashmere blends, knit to last lifetimes." },
  "knitwear": { title: "Knitwear Essentials", matches: ["Knitwear Essentials"], description: "Mongolian cashmere and silk-cashmere blends, knit to last lifetimes." },
  "street-luxury": { title: "Street Luxury", matches: ["Street Luxury"], description: "Hooded overcoats, velour and elevated daywear for the modern city dweller." },
  "streetwear-elite": { title: "Street Luxury", matches: ["Street Luxury"], description: "Hooded overcoats, velour and elevated daywear for the modern city dweller." },
  "ethnic-wear": { title: "Ethnic Wear", matches: ["Tailored Suits"], description: "Heritage silhouettes reimagined for the contemporary gentleman." },
  "blazers": { title: "Blazers", matches: ["Oversized Luxury", "Tailored Suits"], description: "Statement blazers cut for boardrooms and ballrooms alike." },
  "casual-essentials": { title: "Casual Essentials", matches: ["Knitwear Essentials", "Premium Shirts"], description: "Refined weekend pieces — effortless, never careless." },
  "accessories": { title: "Accessories", matches: [], description: "The final note: silk ties, leather goods, and bespoke pocket squares." },
};

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = CATEGORY_MAP[params.slug];
    const title = cat ? `${cat.title} — House of Valerion` : "Category — House of Valerion";
    return {
      meta: [
        { title },
        { name: "description", content: cat?.description ?? "Discover the House of Valerion collection." },
        { property: "og:title", content: title },
      ],
    };
  },
  component: CategorySlugPage,
  notFoundComponent: () => (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        <h1 className="font-display text-4xl">Category not found</h1>
        <Link to="/category" className="mt-6 inline-block text-gold link-underline text-[11px] tracking-luxury uppercase">
          Browse all categories
        </Link>
      </div>
    </div>
  ),
});

function CategorySlugPage() {
  const { slug } = Route.useParams();
  const cat = CATEGORY_MAP[slug];
  if (!cat) throw notFound();

  const items = cat.matches.length
    ? products.filter((p) => cat.matches.includes(p.category))
    : products.slice(0, 6);

  // Related: other categories
  const others = collections.filter((c) => c.id !== slug).slice(0, 4);

  return (
    <>
      <PageHeader eyebrow="Collection" title={cat.title} subtitle={cat.description} />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-10">
          {/* breadcrumb */}
          <nav className="mb-12 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
            <Link to="/" className="hover:text-gold">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/category" className="hover:text-gold">Categories</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{cat.title}</span>
          </nav>

          {items.length === 0 ? (
            <p className="text-center py-32 font-serif italic text-muted-foreground">
              This atelier is in preparation. Please visit again soon.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"
            >
              {items.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </motion.div>
          )}

          {/* Other categories */}
          <section className="mt-32">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-[10px] tracking-wider-luxury uppercase text-gold">— Continue Exploring —</p>
                <h2 className="font-display text-3xl md:text-5xl mt-4">Other Houses</h2>
              </div>
              <Link to="/category" className="hidden md:inline-block text-[11px] tracking-luxury uppercase link-underline">
                All Categories
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.6, delay: i * 0.06 }}
                >
                  <Link to="/category/$slug" params={{ slug: c.id }} className="group block relative overflow-hidden aspect-[3/4] bg-midnight">
                    <img src={c.image} alt={c.title} className="absolute inset-0 h-full w-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/40 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 text-frost">
                      <p className="text-[10px] tracking-luxury uppercase text-gold/90">{c.count} pieces</p>
                      <h3 className="font-display text-xl mt-1">{c.title}</h3>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </PageShell>
    </>
  );
}
