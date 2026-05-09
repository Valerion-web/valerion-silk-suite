import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, X, ShoppingBag } from "lucide-react";
import { products } from "@/lib/products";
import { PageShell, PageHeader } from "@/components/site/PageShell";
import { motion } from "framer-motion";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const items = products.slice(0, 3);
  return (
    <>
      <PageHeader eyebrow="Saved" title="Your Wishlist" subtitle="Pieces awaiting their moment in your wardrobe." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-16">
          {items.length === 0 ? (
            <Empty />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="group relative bg-card shadow-card overflow-hidden"
                >
                  <button className="absolute top-4 right-4 z-10 h-9 w-9 grid place-items-center bg-frost/95 text-midnight hover:bg-gold transition-colors" aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                  <Link to="/product/$productId" params={{ productId: p.id }} className="block aspect-[3/4] overflow-hidden hover-zoom-parent">
                    <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover hover-zoom-img" />
                  </Link>
                  <div className="p-6">
                    <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">{p.category}</p>
                    <h3 className="font-display text-xl mt-1">{p.name}</h3>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="font-serif text-lg">${p.price.toLocaleString()}</p>
                      <button className="inline-flex items-center gap-2 bg-midnight text-frost text-[10px] tracking-luxury uppercase px-4 py-2 hover:bg-gold hover:text-midnight transition-colors">
                        <ShoppingBag className="h-3 w-3" /> Add to Bag
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}

function Empty() {
  return (
    <div className="text-center py-32">
      <Heart className="h-12 w-12 mx-auto text-gold" />
      <h2 className="mt-6 font-display text-3xl">Your wishlist is empty</h2>
      <Link to="/shop" className="mt-8 inline-block bg-midnight text-frost px-9 py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors">
        Discover the Collection
      </Link>
    </div>
  );
}
