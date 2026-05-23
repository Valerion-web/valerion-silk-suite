import { Link, useParams } from "react-router-dom";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Truck,
  Shield,
  RotateCcw,
  Star,
  Plus,
  Minus,
  ChevronRight,
  Ruler,
  Scissors,
  Sparkles,
} from "lucide-react";
import { findProduct, products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { PageShell } from "@/components/site/PageShell";
import { SizeGuide } from "@/components/site/SizeGuide";
import { useShop } from "@/lib/store";
import { toast } from "sonner";



function ProductPage() {
  const { productId } = useParams();
  const product = findProduct(productId ?? "");
  if (!product)
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-[11px] tracking-[0.35em] uppercase text-gold">Product not found</p>
          <h2 className="mt-6 font-display text-4xl text-foreground">This product is unavailable.</h2>
          <p className="mt-4 text-muted-foreground">Please return to the shop and select another piece from the collection.</p>
          <Link to="/shop" className="mt-8 inline-flex items-center justify-center rounded-none bg-gold px-8 py-3 text-[11px] uppercase tracking-luxury text-midnight hover:bg-frost transition-colors">
            Browse the collection
          </Link>
        </div>
      </PageShell>
    );

  const gallery = [
    product.image,
    product.altImage ?? product.image,
    product.image,
    product.altImage ?? product.image,
  ];
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [color, setColor] = useState(product.colors[0]);
  const [qty, setQty] = useState(1);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const related = products
    .filter((p) => p.id !== product.id && p.category === product.category)
    .concat(products.filter((p) => p.id !== product.id && p.category !== product.category))
    .slice(0, 4);

  const handlePrevImage = () => setActiveImg((current) => (current - 1 + gallery.length) % gallery.length);
  const handleNextImage = () => setActiveImg((current) => (current + 1) % gallery.length);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        {/* Breadcrumb */}
        <nav className="mb-10 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
          <Link to="/" className="hover:text-gold transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/shop" className="hover:text-gold transition-colors">Shop</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{product.category}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_460px] gap-12 lg:gap-20">
          {/* Gallery */}
          <div className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-4">
            <div className="hidden md:flex flex-col gap-3">
              {gallery.map((g, i) => (
                <motion.button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  whileHover={{ scale: 1.03 }}
                  className={`aspect-[3/4] overflow-hidden border transition-all duration-300 ${
                    activeImg === i
                      ? "border-gold ring-1 ring-gold/40"
                      : "border-border opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={g} alt="" className="h-full w-full object-cover" />
                </motion.button>
              ))}
            </div>

            <div
              ref={imgRef}
              onClick={() => setLightboxOpen(true)}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setZoomPos(null)}
              className="relative aspect-[3/4] overflow-hidden bg-muted cursor-zoom-in"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImg}
                  src={gallery[activeImg]}
                  alt={product.name}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={
                    zoomPos
                      ? {
                          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                          transform: "scale(1.6)",
                          transition: "transform 0.4s ease-out",
                        }
                      : undefined
                  }
                />
              </AnimatePresence>

              {product.badge && (
                <span className="absolute top-5 left-5 bg-frost/95 text-midnight text-[9px] tracking-luxury uppercase px-3 py-1.5">
                  {product.badge}
                </span>
              )}

              {/* mobile dots */}
              <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      activeImg === i ? "bg-gold w-6" : "bg-frost/70 w-1.5"
                    }`}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence>
              {lightboxOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setLightboxOpen(false)}
                  className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-6"
                >
                  <button
                    onClick={() => setLightboxOpen(false)}
                    className="absolute top-6 right-6 z-10 rounded-sm border border-white/20 bg-black/70 px-4 py-2 text-[11px] uppercase tracking-wider-luxury text-frost hover:bg-white/10"
                    aria-label="Close image preview"
                  >
                    Close
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                    className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 p-3 text-frost hover:bg-white/10"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                    className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/70 p-3 text-frost hover:bg-white/10"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                  <motion.div
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.96, opacity: 0 }}
                    className="relative max-w-[90vw] max-h-[90vh] overflow-hidden rounded-md border border-white/10 bg-black"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={gallery[activeImg]}
                      alt={product.name}
                      className="h-[80vh] w-full object-contain"
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sticky details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="lg:sticky lg:top-28 self-start"
          >
            <p className="text-[10px] tracking-luxury uppercase text-gold">
              {product.category}
            </p>
            <h1 className="font-display text-4xl md:text-5xl mt-3 leading-[1.05]">
              {product.name}
            </h1>

            <div className="mt-5 flex items-center gap-5">
              <p className="font-serif text-3xl">
                ${product.price.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-gold">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-3 w-3 fill-current" />
                ))}
                <span className="text-xs text-muted-foreground ml-2 font-sans">
                  (124 reviews)
                </span>
              </div>
            </div>

            <p className="mt-8 font-serif text-lg italic text-muted-foreground leading-relaxed">
              {product.description}
            </p>

            {/* Color */}
            <div className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] tracking-luxury uppercase">
                  Color —{" "}
                  <span className="text-muted-foreground normal-case tracking-normal italic font-serif">
                    {colorName(color)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                {product.colors.map((c) => (
                  <motion.button
                    key={c}
                    onClick={() => setColor(c)}
                    whileTap={{ scale: 0.92 }}
                    className={`relative h-11 w-11 rounded-full border-2 transition-all duration-300 ${
                      color === c
                        ? "border-gold ring-2 ring-gold/30 ring-offset-2 ring-offset-background"
                        : "border-border hover:border-foreground"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={colorName(c)}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] tracking-luxury uppercase">Size</p>
                <button
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[10px] tracking-luxury uppercase text-gold link-underline"
                >
                  <Ruler className="h-3 w-3" /> Size Guide
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <motion.button
                    key={s}
                    onClick={() => setSize(s)}
                    whileTap={{ scale: 0.94 }}
                    className={`min-w-12 h-12 px-4 border text-xs tracking-luxury transition-all duration-300 ${
                      size === s
                        ? "border-gold bg-gold text-midnight"
                        : "border-border hover:border-foreground"
                    }`}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
              {!size && (
                <p className="mt-3 text-[10px] tracking-luxury uppercase text-muted-foreground">
                  Select a size to continue
                </p>
              )}
            </div>

            {/* CTA */}
            <ProductCTA product={product} size={size} color={color} qty={qty} setQty={setQty} />

            {/* Scarcity */}
            <div className="mt-6 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              Only 7 pieces remain in this size
            </div>

            {/* Trust */}
            <div className="mt-10 grid grid-cols-3 gap-4 pt-8 border-t border-border">
              {[
                { Icon: Truck, label: "Complimentary Delivery" },
                { Icon: RotateCcw, label: "Free 30-Day Returns" },
                { Icon: Shield, label: "Lifetime Craftsmanship" },
              ].map(({ Icon, label }) => (
                <div key={label} className="text-center">
                  <Icon className="h-5 w-5 mx-auto text-gold" />
                  <p className="mt-2 text-[10px] tracking-luxury uppercase text-muted-foreground leading-relaxed">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="mt-10 space-y-0 text-sm">
              <Detail
                title="Fabric & Craft"
                icon={<Scissors className="h-3 w-3" />}
                defaultOpen
              >
                {product.fabric}. Hand-finished in our Milano atelier. Each
                piece carries the stitched signature of its tailor and a unique
                serial woven into the inner placket.
              </Detail>
              <Detail title="Care" icon={<Sparkles className="h-3 w-3" />}>
                Dry clean only. Steam to refresh between wears. Store on a wide
                wooden hanger inside the dust bag provided.
              </Detail>
              <Detail title="Delivery & Returns" icon={<Truck className="h-3 w-3" />}>
                Complimentary express delivery worldwide within 3 business days.
                Discreet packaging in our signature navy box. Returns accepted
                within 30 days, unworn with original tags.
              </Detail>
            </div>
          </motion.div>
        </div>

        {/* Editorial band */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-32 overflow-hidden bg-gradient-navy text-frost"
        >
          <div className="absolute inset-0 bg-radial-gold opacity-50" />
          <div className="film-grain relative grid md:grid-cols-2 gap-12 px-8 md:px-16 py-20 md:py-28">
            <div>
              <p className="text-[10px] tracking-wider-luxury uppercase text-gold">
                — The Atelier —
              </p>
              <h2 className="mt-6 font-display text-4xl md:text-5xl leading-[1.1]">
                Engineered for the
                <br />
                modern gentleman
              </h2>
            </div>
            <div className="space-y-5 font-serif italic text-lg text-frost/80 leading-relaxed">
              <p>
                Every stitch of the {product.name.toLowerCase()} is the
                culmination of 47 individual operations performed by a single
                master tailor in our Milano workshop.
              </p>
              <p>
                We do not mass-produce. Each piece is cut to order and inspected
                under natural light before bearing the House of Valerion seal.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-32">
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="text-[10px] tracking-wider-luxury uppercase text-gold">
                  — Curated Pairings —
                </p>
                <h2 className="font-display text-3xl md:text-5xl mt-4">
                  You may also consider
                </h2>
              </div>
              <Link
                to="/shop"
                className="hidden md:inline-block text-[11px] tracking-luxury uppercase link-underline"
              >
                View All
              </Link>
            </div>
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>
      <SizeGuide open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />
    </PageShell>
  );
}

function colorName(hex: string) {
  const map: Record<string, string> = {
    "#0A1931": "Royal Navy",
    "#1E3A8A": "Sapphire",
    "#1f1f1f": "Obsidian",
    "#000": "Noir",
    "#000000": "Noir",
    "#F8FAFC": "Ivory Frost",
    "#D4AF37": "Soft Gold",
    "#071120": "Midnight",
  };
  return map[hex] ?? "Signature";
}

function ProductCTA({
  product,
  size,
  color,
  qty,
  setQty,
}: {
  product: NonNullable<ReturnType<typeof findProduct>>;
  size: string | null;
  color: string;
  qty: number;
  setQty: (n: number) => void;
}) {
  const { addToCart, toggleWishlist, inWishlist } = useShop();
  const wished = inWishlist(product.id);
  const handleAdd = () => {
    if (!size) {
      toast("Please select a size", { className: "luxury-toast" });
      return;
    }
    addToCart({ id: product.id, qty, size, color }, product.name);
  };
  return (
    <div className="mt-10 flex items-stretch gap-3">
      <div className="flex items-center border border-border">
        <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-12 w-12 grid place-items-center hover:bg-muted transition-colors" aria-label="Decrease">
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-10 text-center text-sm">{qty}</span>
        <button onClick={() => setQty(qty + 1)} className="h-12 w-12 grid place-items-center hover:bg-muted transition-colors" aria-label="Increase">
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <motion.button
        onClick={handleAdd}
        whileHover={{ y: -2, boxShadow: "0 0 32px rgba(212,175,55,0.45)" }}
        whileTap={{ scale: 0.97 }}
        className="flex-1 bg-midnight text-frost text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500"
      >
        Add to Bag
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => toggleWishlist(product.id, product.name)}
        className={`h-12 w-12 grid place-items-center border transition-colors ${wished ? "border-gold bg-gold text-midnight" : "border-border hover:border-gold hover:text-gold"}`}
        aria-label="Wishlist"
      >
        <Heart className={`h-4 w-4 ${wished ? "fill-current" : ""}`} />
      </motion.button>
    </div>
  );
}


function Detail({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-[11px] tracking-luxury uppercase group"
      >
        <span className="inline-flex items-center gap-3">
          {icon && <span className="text-gold">{icon}</span>}
          {title}
        </span>
        <Plus
          className={`h-3 w-3 transition-transform duration-500 ${
            open ? "rotate-45 text-gold" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 font-serif italic text-muted-foreground leading-relaxed">
              {children}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProductPage;
