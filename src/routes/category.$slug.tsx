import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { categories, getCategoryBySlug, getProductsByCategorySlug, slugifyCategory } from "@/lib/products";
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



function CategorySlugPage() {
  const location = useLocation();
  const rootPath = location.pathname.startsWith("/collection") ? "/collection" : "/category";
  const { slug } = useParams();
  const category = resolveCategory(slug ?? "");
  if (!category)
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-[11px] tracking-[0.35em] uppercase text-gold">Category not found</p>
          <h2 className="mt-6 font-display text-4xl text-foreground">This collection is unavailable.</h2>
          <p className="mt-4 text-muted-foreground">Please choose another collection from our edit or return to the shop.</p>
          <Link to="/shop" className="mt-8 inline-flex items-center justify-center rounded-none bg-gold px-8 py-3 text-[11px] uppercase tracking-luxury text-midnight hover:bg-frost transition-colors">
            Browse the collection
          </Link>
        </div>
      </PageShell>
    );

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
            <Link to={rootPath} className="hover:text-gold">Categories</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{category}</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="mb-12 border-y border-gold/20 py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex items-center gap-3 text-[10px] tracking-luxury uppercase text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Dynamic Atelier Edit
            </div>
            <p className="text-[11px] tracking-luxury uppercase text-muted-foreground">
              <span className="text-foreground">{items.length}</span> {items.length === 1 ? "piece" : "pieces"} loaded for {category}
            </p>
          </motion.div>

          {items.length === 0 ? (
            <p className="text-center py-32 font-serif italic text-muted-foreground">
              This atelier is in preparation. Please visit again soon.
            </p>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
              <Link to={rootPath} className="hidden md:inline-block text-[11px] tracking-luxury uppercase link-underline">
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
                  <Link to={`${rootPath}/${c.id}`} className="group block relative overflow-hidden aspect-[3/4] bg-background border border-border shadow-card">
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

export default CategorySlugPage;
