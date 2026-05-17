import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { categories, getCategoryBySlug, getProductsByCategorySlug, products, slugifyCategory } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageShell, PageHeader } from "@/components/site/PageShell";
import suits from "@/assets/collection-suits.jpg";
import shirts from "@/assets/collection-shirts.jpg";
import oversized from "@/assets/collection-oversized.jpg";
import formal from "@/assets/collection-formal.jpg";
import knitwear from "@/assets/collection-knitwear.jpg";
import street from "@/assets/collection-street.jpg";
import ethnic from "@/assets/cat-ethnic.jpg";
import accessories from "@/assets/cat-accessories.jpg";

const CATEGORY_COPY: Record<string, string> = {
  "Tailored Suits": "Sculpted silhouettes engineered for the gentleman who measures success in millimetres.",
  "Premium Shirts": "Sea Island and Egyptian cotton, hand-finished placards, mother-of-pearl buttons.",
  "Oversized Luxury": "Relaxed proportions in noble fabrics — quiet luxury redefined.",
  "Modern Formalwear": "Tuxedos and three-piece compositions for the most discerning evenings.",
  "Knitwear Essentials": "Mongolian cashmere and silk-cashmere blends, knit to last lifetimes.",
  "Street Luxury": "Hooded overcoats, velour and elevated daywear for the modern city dweller.",
  "Ethnic Wear": "Heritage silhouettes reimagined for the contemporary gentleman.",
  Accessories: "The final note: silk pocket squares, leather goods, and decisive finishing touches.",
};

const CATEGORY_IMAGES: Record<string, string> = {
  "Tailored Suits": suits,
  "Premium Shirts": shirts,
  "Oversized Luxury": oversized,
  "Modern Formalwear": formal,
  "Knitwear Essentials": knitwear,
  "Street Luxury": street,
  "Ethnic Wear": ethnic,
  Accessories: accessories,
};

const LEGACY_SLUGS: Record<string, string> = {
  knitwear: "knitwear-essentials",
  "streetwear-elite": "street-luxury",
  blazers: "modern-formalwear",
  "casual-essentials": "knitwear-essentials",
};

const resolveCategory = (slug: string) => getCategoryBySlug(LEGACY_SLUGS[slug] ?? slug);

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const category = resolveCategory(params.slug);
    const title = category ? `${category} — House of Valerion` : "Category — House of Valerion";
    return {
      meta: [
        { title },
        { name: "description", content: category ? CATEGORY_COPY[category] : "Discover the House of Valerion collection." },
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
  const category = resolveCategory(slug);
  if (!category) throw notFound();

  const resolvedSlug = slugifyCategory(category);
  const items = getProductsByCategorySlug(resolvedSlug);

  const others = categories
    .filter((title) => title !== "All" && title !== category)
    .map((title) => {
      const id = slugifyCategory(title);
      return {
        id,
        title,
        image: CATEGORY_IMAGES[title],
        count: getProductsByCategorySlug(id).length,
      };
    })
    .slice(0, 4);

  return (
    <>
      <PageHeader eyebrow="Collection" title={category} subtitle={CATEGORY_COPY[category]} />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-10">
          {/* breadcrumb */}
          <nav className="mb-12 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
            <Link to="/" className="hover:text-gold">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/category" className="hover:text-gold">Categories</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{category}</span>
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
