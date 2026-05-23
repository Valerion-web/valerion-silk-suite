import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageHeader, PageShell } from "@/components/site/PageShell";
import { ImageLightbox } from "@/components/ImageLightbox";
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
  const location = useLocation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const isCategoryRoot = location.pathname === "/category" || location.pathname === "/collection";
  const rootPath = location.pathname.startsWith("/collection") ? "/collection" : "/category";
  const images = CATEGORIES.map((cat) => cat.image);

  if (!isCategoryRoot) return <Outlet />;

  return (
    <>
      <PageHeader
        eyebrow="The Maison"
        title="Collections"
        subtitle="Each universe, a chapter in the House of Valerion. Explore the silhouettes that define the modern gentleman."
      />
      <PageShell className="pt-0">
        <div className="w-full max-w-7xl mx-auto overflow-x-hidden px-4 sm:px-6 md:px-10 lg:px-12 mt-8 sm:mt-10 md:mt-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {CATEGORIES.map((cat, i) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                index={i}
                rootPath={rootPath}
                onImageClick={() => setSelectedIndex(i)}
              />
            ))}
          </div>

          <ImageLightbox
            images={images}
            selectedIndex={selectedIndex}
            onClose={() => setSelectedIndex(null)}
            onNext={() => selectedIndex !== null && setSelectedIndex((current) => (current === null ? null : (current + 1) % images.length))}
            onPrev={() => selectedIndex !== null && setSelectedIndex((current) => (current === null ? null : (current - 1 + images.length) % images.length))}
          />

          <div className="mt-16 md:mt-24 text-center">
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
  rootPath,
  onImageClick,
}: {
  cat: { id: string; title: string; count: number; image: string; span: string };
  index: number;
  rootPath: string;
  onImageClick: () => void;
}) {
  return (
    <div className={`group relative overflow-hidden bg-background border border-border shadow-card ${cat.span} min-h-[320px] sm:min-h-[420px] md:min-h-[520px]`}>
      <Link to={`${rootPath}/${cat.id}`} className="block h-full w-full">
        <div className="relative w-full h-[320px] sm:h-[420px] md:h-[520px] overflow-hidden bg-gray-100">
          <img
            src={cat.image}
            alt={cat.title}
            loading="eager"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onImageClick();
            }}
            className="w-full h-full object-cover"
          />

          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-midnight/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="pointer-events-none absolute inset-4 border border-gold/0 group-hover:border-gold/40 transition-all duration-700" />

          <div className="absolute top-6 left-6 text-[10px] tracking-wider-luxury text-gold/80">
            0{index + 1}
          </div>

          <div className="absolute top-6 right-6 h-9 w-9 grid place-items-center rounded-full border border-frost/20 text-frost/70 group-hover:border-gold group-hover:text-gold group-hover:rotate-45 transition-all duration-500">
            <ArrowUpRight className="h-4 w-4" />
          </div>

          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 md:p-6 text-frost">
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
        </div>
      </Link>
    </div>
  );
}

export default CategoryPage;
