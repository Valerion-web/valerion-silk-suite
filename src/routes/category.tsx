import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { PageHeader, PageShell } from "@/components/site/PageShell";
import suits from "@/assets/collection-suits.jpg";
import shirts from "@/assets/collection-shirts.jpg";
import oversized from "@/assets/collection-oversized.jpg";
import knitwear from "@/assets/collection-knitwear.jpg";
import street from "@/assets/collection-street.jpg";
import blazers from "@/assets/cat-blazers.jpg";
import ethnic from "@/assets/cat-ethnic.jpg";
import casual from "@/assets/cat-casual.jpg";
import accessories from "@/assets/cat-accessories.jpg";
import { categories, getProductsByCategorySlug, slugifyCategory } from "@/lib/products";

export const Route = createFileRoute("/category")({
  head: () => ({
    meta: [
      { title: "Category — House of Valerion" },
      { name: "description", content: "Discover the world of House of Valerion through our curated luxury menswear categories." },
      { property: "og:title", content: "Category — House of Valerion" },
      { property: "og:description", content: "Tailored suits, premium shirts, oversized luxury, ethnic wear and more." },
    ],
  }),
  component: CategoryPage,
});

const CATEGORY_VISUALS: Record<string, { image: string; span: string }> = {
  "Tailored Suits": { image: suits, span: "lg:row-span-2" },
  "Premium Shirts": { image: shirts, span: "" },
  "Oversized Luxury": { image: oversized, span: "" },
  "Modern Formalwear": { image: blazers, span: "lg:row-span-2" },
  "Knitwear Essentials": { image: knitwear, span: "" },
  "Street Luxury": { image: street, span: "" },
  "Ethnic Wear": { image: ethnic, span: "" },
  Accessories: { image: accessories, span: "lg:col-span-2" },
};

const CATEGORIES = categories
  .filter((title) => title !== "All")
  .map((title) => {
    const id = slugifyCategory(title);
    const visual = CATEGORY_VISUALS[title] ?? { image: casual, span: "" };
    return { id, title, count: getProductsByCategorySlug(id).length, ...visual };
  });

function CategoryPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/category") return <Outlet />;

  return (
    <>
      <PageHeader
        eyebrow="The Maison"
        title="Categories"
        subtitle="Each universe, a chapter in the House of Valerion. Explore the silhouettes that define the modern gentleman."
      />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:auto-rows-[420px]">
            {CATEGORIES.map((cat, i) => (
              <CategoryCard key={cat.id} cat={cat} index={i} />
            ))}
          </div>

          <div className="mt-24 text-center">
            <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-4">— Couture Atelier —</p>
            <h2 className="font-display text-3xl md:text-4xl mb-4">Bespoke, on appointment.</h2>
            <p className="font-serif italic text-muted-foreground max-w-xl mx-auto mb-8">
              Beyond ready-to-wear, our master tailors craft made-to-measure pieces in the heart of Milano.
            </p>
            <Link to="/contact" className="inline-block link-underline text-[11px] tracking-luxury uppercase text-gold">
              Request an Atelier Visit
            </Link>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function CategoryCard({
  cat,
  index,
}: {
  cat: { id: string; title: string; count: number; image: string; span: string };
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden bg-midnight ${cat.span}`}
    >
      <Link to="/category/$slug" params={{ slug: cat.id }} className="block h-full w-full">
        <div className="absolute inset-0 hover-zoom-parent">
          <img
            src={cat.image}
            alt={cat.title}
            loading="lazy"
            className="h-full w-full object-cover hover-zoom-img opacity-90 group-hover:opacity-100 transition-opacity duration-700"
          />
        </div>

        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-midnight/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        {/* Gold hairline frame on hover */}
        <div className="pointer-events-none absolute inset-4 border border-gold/0 group-hover:border-gold/40 transition-all duration-700" />

        {/* Number */}
        <div className="absolute top-6 left-6 text-[10px] tracking-wider-luxury text-gold/80">
          0{index + 1}
        </div>

        <div className="absolute top-6 right-6 h-9 w-9 grid place-items-center rounded-full border border-frost/20 text-frost/70 group-hover:border-gold group-hover:text-gold group-hover:rotate-45 transition-all duration-500">
          <ArrowUpRight className="h-4 w-4" />
        </div>

        {/* Bottom content */}
        <div className="absolute bottom-0 inset-x-0 p-7 md:p-9 text-frost">
          <p className="text-[10px] tracking-wider-luxury uppercase text-gold/90 mb-3">
            {cat.count} {cat.count === 1 ? "piece" : "pieces"}
          </p>
          <h3 className="font-display text-2xl md:text-3xl leading-tight transition-transform duration-700 group-hover:translate-x-1">
            {cat.title}
          </h3>
          <div className="mt-4 h-px w-12 bg-gradient-to-r from-gold to-transparent transition-all duration-700 group-hover:w-24" />
          <p className="mt-4 text-[11px] tracking-luxury uppercase text-frost/60 opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            Discover the Edit →
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
