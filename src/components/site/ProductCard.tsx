import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Heart, Eye } from "lucide-react";
import type { Product } from "@/lib/products";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group"
    >
      <Link to="/product/$productId" params={{ productId: product.id }} className="block">
        <div className="relative overflow-hidden bg-muted aspect-[3/4] hover-zoom-parent">
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

          <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <button className="h-9 w-9 grid place-items-center bg-frost/95 text-midnight hover:bg-gold transition-colors" aria-label="Wishlist">
              <Heart className="h-4 w-4" />
            </button>
            <button className="h-9 w-9 grid place-items-center bg-frost/95 text-midnight hover:bg-gold transition-colors" aria-label="Quick view">
              <Eye className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out bg-midnight text-frost text-[11px] tracking-luxury uppercase text-center py-3">
            Add to Bag
          </div>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">{product.category}</p>
            <h3 className="font-display text-lg mt-1 leading-tight">{product.name}</h3>
          </div>
          <div className="text-right shrink-0">
            <p className="font-serif text-lg">${product.price.toLocaleString()}</p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
