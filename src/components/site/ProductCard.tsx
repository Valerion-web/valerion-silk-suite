import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Heart, Eye, Star, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/products";
import { useShop } from "@/lib/store";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { toggleWishlist, inWishlist, addToCart } = useShop();
  const wished = inWishlist(product.id);

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id, product.name);
  };

  const handleAddToBag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(
      { id: product.id, qty: 1, size: product.sizes[0], color: product.colors[0] },
      product.name,
    );
  };

  const rating = product.rating ?? 4.8;
  const reviews = product.reviews ?? 124;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <div className="relative overflow-hidden bg-muted aspect-[3/4] hover-zoom-parent">
        <Link to="/product/$productId" params={{ productId: product.id }} className="absolute inset-0 block" aria-label={`Open ${product.name}`}>
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover hover-zoom-img"
          />
          {product.altImage && (
            <img
              src={product.altImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-midnight/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {product.badge && (
            <span className="absolute top-4 left-4 bg-frost/95 text-midnight text-[9px] tracking-luxury uppercase px-3 py-1.5">
              {product.badge}
            </span>
          )}
        </Link>

          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleWishlist}
              className={`h-9 w-9 grid place-items-center transition-colors ${wished ? "bg-gold text-midnight" : "bg-frost/95 text-midnight hover:bg-gold"}`}
              aria-label="Wishlist"
            >
              <Heart className={`h-4 w-4 ${wished ? "fill-current" : ""}`} />
            </motion.button>
            <Link to="/product/$productId" params={{ productId: product.id }} className="h-9 w-9 grid place-items-center bg-frost/95 text-midnight hover:bg-gold transition-colors" aria-label="Quick preview">
              <Eye className="h-4 w-4" />
            </Link>
          </div>

          <div className="absolute bottom-12 left-4 right-4 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
            <div className="inline-flex items-center gap-1.5 bg-midnight/70 text-frost backdrop-blur-md border border-gold/25 px-3 py-2 text-[10px] tracking-luxury uppercase">
              <Eye className="h-3 w-3 text-gold" /> Quick Preview
            </div>
          </div>

          <button
            onClick={handleAddToBag}
            className="absolute bottom-0 inset-x-0 z-10 md:translate-y-full md:group-hover:translate-y-0 transition-transform duration-500 ease-out bg-midnight text-frost text-[11px] tracking-luxury uppercase text-center py-3 hover:bg-gold hover:text-midnight inline-flex items-center justify-center gap-2"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Add to Bag
          </button>
        </div>

        <Link to="/product/$productId" params={{ productId: product.id }} className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">{product.category}</p>
            <h3 className="font-display text-lg mt-1 leading-tight">{product.name}</h3>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3 w-3 ${i < Math.floor(rating) ? "fill-current" : ""}`} />
                ))}
              </span>
              <span>{rating.toFixed(1)} · {reviews} reviews</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-serif text-lg">${product.price.toLocaleString()}</p>
          </div>
        </Link>
    </motion.div>
  );
}
