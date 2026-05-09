import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Minus, X, ArrowRight } from "lucide-react";
import { products } from "@/lib/products";
import { PageShell, PageHeader } from "@/components/site/PageShell";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

type Item = { id: string; qty: number; size: string };
const initial: Item[] = [
  { id: products[0].id, qty: 1, size: "50" },
  { id: products[4].id, qty: 2, size: "M" },
];

function CartPage() {
  const [items, setItems] = useState(initial);

  const lines = items.map((i) => ({ ...i, product: products.find((p) => p.id === i.id)! })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const shipping = subtotal > 0 ? 0 : 0;
  const total = subtotal + shipping;

  const update = (id: string, qty: number) => setItems((s) => s.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));
  const remove = (id: string) => setItems((s) => s.filter((i) => i.id !== id));

  return (
    <>
      <PageHeader eyebrow="Shopping Bag" title="Your Selection" />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-16">
          {lines.length === 0 ? (
            <div className="text-center py-32">
              <h2 className="font-display text-3xl">Your bag is empty</h2>
              <Link to="/shop" className="mt-8 inline-block bg-midnight text-frost px-9 py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors">
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1fr_400px] gap-12">
              <div className="space-y-6">
                {lines.map((l) => (
                  <div key={l.id} className="glass-light flex gap-6 p-5">
                    <Link to="/product/$productId" params={{ productId: l.id }} className="w-32 aspect-[3/4] shrink-0 overflow-hidden bg-muted">
                      <img src={l.product.image} alt={l.product.name} className="h-full w-full object-cover" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">{l.product.category}</p>
                          <h3 className="font-display text-xl mt-1">{l.product.name}</h3>
                          <p className="text-xs mt-2 text-muted-foreground">Size {l.size} · {l.product.fabric}</p>
                        </div>
                        <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><X className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-6 flex items-end justify-between">
                        <div className="flex items-center border border-border">
                          <button onClick={() => update(l.id, l.qty - 1)} className="h-10 w-10 grid place-items-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                          <span className="w-10 text-center text-sm">{l.qty}</span>
                          <button onClick={() => update(l.id, l.qty + 1)} className="h-10 w-10 grid place-items-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
                        </div>
                        <p className="font-serif text-xl">${(l.product.price * l.qty).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <aside className="lg:sticky lg:top-28 self-start glass-light p-8">
                <h3 className="font-display text-2xl">Order Summary</h3>

                <div className="mt-6 flex gap-2">
                  <input placeholder="Promo code" className="flex-1 bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-gold" />
                  <button className="border border-border px-4 text-[10px] tracking-luxury uppercase hover:border-gold">Apply</button>
                </div>

                <div className="mt-8 space-y-3 text-sm">
                  <Row label="Subtotal" value={`$${subtotal.toLocaleString()}`} />
                  <Row label="Shipping" value={shipping === 0 ? "Complimentary" : `$${shipping}`} />
                  <Row label="Tax" value="Calculated at checkout" />
                </div>

                <div className="mt-6 pt-6 border-t border-border flex justify-between items-baseline">
                  <span className="text-[11px] tracking-luxury uppercase">Total</span>
                  <span className="font-display text-3xl">${total.toLocaleString()}</span>
                </div>

                <button className="mt-8 w-full bg-midnight text-frost py-4 text-[11px] tracking-luxury uppercase inline-flex items-center justify-center gap-2 hover:bg-gold hover:text-midnight transition-colors duration-500">
                  Proceed to Checkout <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-4 text-[10px] tracking-luxury uppercase text-muted-foreground text-center">Secure · Discreet · Insured</p>
              </aside>
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
