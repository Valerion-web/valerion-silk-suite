import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Truck, Shield, RotateCcw, Star, Plus, Minus } from "lucide-react";
import { findProduct, products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageShell } from "@/components/site/PageShell";

export const Route = createFileRoute("/product/$productId")({
  component: ProductPage,
  notFoundComponent: () => (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center">
        <h1 className="font-display text-4xl">Piece not found</h1>
        <Link to="/shop" className="mt-6 inline-block text-gold link-underline text-[11px] tracking-luxury uppercase">Back to shop</Link>
      </div>
    </div>
  ),
});

function ProductPage() {
  const { productId } = Route.useParams();
  const product = findProduct(productId);
  if (!product) throw notFound();

  const gallery = [product.image, product.altImage ?? product.image, product.image, product.altImage ?? product.image];
  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);

  const related = products.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 4);

  return (
    <PageShell>
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <p className="text-[10px] tracking-luxury uppercase text-muted-foreground mb-8">
          <Link to="/shop" className="link-underline">Shop</Link> / {product.category}
        </p>

        <div className="grid lg:grid-cols-[1fr_480px] gap-12 lg:gap-16">
          <div className="grid grid-cols-[80px_1fr] gap-4">
            <div className="flex flex-col gap-3">
              {gallery.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-[3/4] overflow-hidden border ${activeImg === i ? "border-gold" : "border-border"}`}
                >
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <motion.div
              key={activeImg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="aspect-[3/4] overflow-hidden bg-muted hover-zoom-parent"
            >
              <img src={gallery[activeImg]} alt={product.name} className="h-full w-full object-cover hover-zoom-img" />
            </motion.div>
          </div>

          <div className="lg:sticky lg:top-28 self-start">
            <p className="text-[10px] tracking-luxury uppercase text-gold">{product.category}</p>
            <h1 className="font-display text-4xl md:text-5xl mt-3 leading-[1.05]">{product.name}</h1>
            <div className="mt-4 flex items-center gap-4">
              <p className="font-serif text-3xl">${product.price.toLocaleString()}</p>
              <div className="flex gap-1 text-gold">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-3 w-3 fill-current" />)}
                <span className="text-xs text-muted-foreground ml-2 font-sans">(124)</span>
              </div>
            </div>

            <p className="mt-8 font-serif text-lg italic text-muted-foreground leading-relaxed">{product.description}</p>

            <div className="mt-10">
              <p className="text-[11px] tracking-luxury uppercase mb-3">Color</p>
              <div className="flex gap-3">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`h-10 w-10 rounded-full border-2 ${color === c ? "border-gold ring-2 ring-gold/30" : "border-border"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] tracking-luxury uppercase">Size</p>
                <button className="text-[10px] tracking-luxury uppercase text-gold link-underline">Size Guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-12 h-12 px-3 border text-xs tracking-luxury ${size === s ? "border-gold bg-gold text-midnight" : "border-border hover:border-foreground"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 flex items-stretch gap-3">
              <div className="flex items-center border border-border">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-12 w-12 grid place-items-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                <span className="w-10 text-center text-sm">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="h-12 w-12 grid place-items-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
              </div>
              <button className="flex-1 bg-midnight text-frost text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500">
                Add to Bag
              </button>
              <button className="h-12 w-12 grid place-items-center border border-border hover:border-gold hover:text-gold" aria-label="Wishlist">
                <Heart className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-border">
              {[
                { Icon: Truck, label: "Complimentary Delivery" },
                { Icon: RotateCcw, label: "Free 30-Day Returns" },
                { Icon: Shield, label: "Lifetime Craftsmanship" },
              ].map(({ Icon, label }) => (
                <div key={label} className="text-center">
                  <Icon className="h-5 w-5 mx-auto text-gold" />
                  <p className="mt-2 text-[10px] tracking-luxury uppercase text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 space-y-4 text-sm">
              <Detail title="Fabric & Craft">
                {product.fabric}. Hand-finished in our Milano atelier. Each piece carries the stitched signature of its tailor.
              </Detail>
              <Detail title="Care">
                Dry clean only. Steam to refresh between wears. Store on a wide wooden hanger.
              </Detail>
              <Detail title="Delivery">
                Complimentary express delivery worldwide. Discreet packaging in our signature navy box.
              </Detail>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-32">
            <h2 className="font-display text-3xl md:text-4xl mb-10">You may also consider</h2>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Detail({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border pt-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-[11px] tracking-luxury uppercase">
        {title}
        <Plus className={`h-3 w-3 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
      {open && <p className="mt-3 font-serif italic text-muted-foreground leading-relaxed">{children}</p>}
    </div>
  );
}
