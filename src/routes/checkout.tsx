import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, CreditCard, Smartphone, Wallet, Banknote, CheckCircle2, ChevronRight } from "lucide-react";
import { findProduct } from "@/lib/products";
import { PageShell, PageHeader } from "@/components/site/PageShell";
import { useShop } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — House of Valerion" },
      { name: "description", content: "Secure checkout for House of Valerion. Premium shipping and discreet packaging." },
    ],
  }),
  component: CheckoutPage,
});

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
  { id: "gpay", label: "Google Pay", icon: Wallet },
  { id: "phonepe", label: "PhonePe", icon: Wallet },
  { id: "paytm", label: "Paytm", icon: Wallet },
  { id: "netbanking", label: "Net Banking", icon: Banknote },
  { id: "cod", label: "Cash on Delivery", icon: Banknote },
];

function CheckoutPage() {
  const { cart, clearCart } = useShop();
  const navigate = useNavigate();

  const lines = cart
    .map((c) => ({ ...c, product: findProduct(c.id) }))
    .filter((l) => l.product) as Array<{ id: string; qty: number; size: string; color: string; product: NonNullable<ReturnType<typeof findProduct>> }>;

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const shipping = subtotal > 0 ? 0 : 0;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + tax;

  const [ship, setShip] = useState({
    name: "", mobile: "", email: "", address: "", apartment: "",
    city: "", state: "", pincode: "", country: "India",
  });
  const [pay, setPay] = useState("card");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [upi, setUpi] = useState("");
  const [placed, setPlaced] = useState(false);

  const placeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setPlaced(true);
  };

  if (lines.length === 0 && !placed) {
    return (
      <>
        <PageHeader eyebrow="Secure Checkout" title="Checkout" />
        <PageShell className="pt-0">
          <div className="text-center py-32">
            <h2 className="font-display text-3xl">Your bag is empty</h2>
            <Link to="/shop" className="mt-8 inline-block bg-midnight text-frost px-9 py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors">
              Continue Shopping
            </Link>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Secure Checkout" title="Checkout" subtitle="Your details are encrypted and protected end-to-end." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 mt-10">
          <nav className="mb-10 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
            <Link to="/cart" className="hover:text-gold">Cart</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gold">Checkout</span>
            <ChevronRight className="h-3 w-3" />
            <span>Confirmation</span>
          </nav>

          <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr_420px] gap-12">
            <div className="space-y-10">
              {/* SHIPPING */}
              <Section number="01" title="Shipping Details">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Floating label="Full Name" value={ship.name} onChange={(v) => setShip({ ...ship, name: v })} required />
                  <Floating label="Mobile Number" value={ship.mobile} onChange={(v) => setShip({ ...ship, mobile: v })} type="tel" required />
                  <Floating label="Email Address" value={ship.email} onChange={(v) => setShip({ ...ship, email: v })} type="email" required className="sm:col-span-2" />
                  <Floating label="Street Address" value={ship.address} onChange={(v) => setShip({ ...ship, address: v })} required className="sm:col-span-2" />
                  <Floating label="Apartment / Landmark" value={ship.apartment} onChange={(v) => setShip({ ...ship, apartment: v })} className="sm:col-span-2" />
                  <Floating label="City" value={ship.city} onChange={(v) => setShip({ ...ship, city: v })} required />
                  <Floating label="State" value={ship.state} onChange={(v) => setShip({ ...ship, state: v })} required />
                  <Floating label="Pincode" value={ship.pincode} onChange={(v) => setShip({ ...ship, pincode: v })} required />
                  <Floating label="Country" value={ship.country} onChange={(v) => setShip({ ...ship, country: v })} required />
                </div>
              </Section>

              {/* PAYMENT */}
              <Section number="02" title="Payment Method" right={<span className="inline-flex items-center gap-2 text-[10px] tracking-luxury uppercase text-gold"><Lock className="h-3 w-3" /> Secure</span>}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = pay === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPay(m.id)}
                        className={`flex items-center gap-3 px-4 py-4 border text-left transition-all ${active ? "border-gold bg-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.2)]" : "border-border hover:border-gold/60"}`}
                      >
                        <Icon className={`h-5 w-5 ${active ? "text-gold" : "text-muted-foreground"}`} />
                        <span className="text-[11px] tracking-luxury uppercase">{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {pay === "card" && (
                    <motion.div
                      key="card"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-8 grid sm:grid-cols-2 gap-5"
                    >
                      <Floating label="Card Number" value={card.number} onChange={(v) => setCard({ ...card, number: v })} className="sm:col-span-2" placeholder="0000 0000 0000 0000" />
                      <Floating label="Card Holder Name" value={card.name} onChange={(v) => setCard({ ...card, name: v })} className="sm:col-span-2" />
                      <Floating label="Expiry (MM/YY)" value={card.expiry} onChange={(v) => setCard({ ...card, expiry: v })} placeholder="MM/YY" />
                      <Floating label="CVV" value={card.cvv} onChange={(v) => setCard({ ...card, cvv: v })} type="password" />
                    </motion.div>
                  )}
                  {(pay === "upi" || pay === "gpay" || pay === "phonepe" || pay === "paytm") && (
                    <motion.div key="upi" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8">
                      <Floating label="UPI ID" value={upi} onChange={setUpi} placeholder="yourname@bank" />
                    </motion.div>
                  )}
                  {pay === "netbanking" && (
                    <motion.div key="nb" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-8">
                      <select className="w-full bg-transparent border border-border px-4 py-4 text-sm outline-none focus:border-gold">
                        <option>HDFC Bank</option><option>ICICI Bank</option><option>State Bank of India</option>
                        <option>Axis Bank</option><option>Kotak Mahindra</option><option>Yes Bank</option>
                      </select>
                    </motion.div>
                  )}
                  {pay === "cod" && (
                    <motion.p key="cod" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 font-serif italic text-muted-foreground">
                      Pay in cash upon delivery. Available for orders under ₹50,000.
                    </motion.p>
                  )}
                </AnimatePresence>
              </Section>

              <motion.button
                whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                className="w-full bg-midnight text-frost py-5 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500 inline-flex items-center justify-center gap-3"
              >
                <Lock className="h-4 w-4" /> Place Order · ${total.toLocaleString()}
              </motion.button>
            </div>

            {/* ORDER SUMMARY */}
            <aside className="lg:sticky lg:top-28 self-start">
              <div className="glass-light p-8 border border-gold/20">
                <h3 className="font-display text-2xl">Order Summary</h3>
                <div className="mt-6 space-y-5 max-h-[360px] overflow-y-auto pr-2">
                  {lines.map((l) => (
                    <div key={`${l.id}-${l.size}-${l.color}`} className="flex gap-4">
                      <div className="w-20 aspect-[3/4] shrink-0 overflow-hidden bg-muted relative">
                        <img src={l.product.image} alt={l.product.name} className="h-full w-full object-cover" />
                        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 grid place-items-center rounded-full bg-gold text-midnight text-[10px] font-semibold">
                          {l.qty}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] tracking-luxury uppercase text-muted-foreground">{l.product.category}</p>
                        <h4 className="font-display text-sm mt-1 leading-tight">{l.product.name}</h4>
                        <p className="text-[10px] tracking-luxury uppercase text-muted-foreground mt-1">Size {l.size}</p>
                      </div>
                      <p className="font-serif text-sm shrink-0">${(l.product.price * l.qty).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-border space-y-3 text-sm">
                  <Row label="Subtotal" value={`$${subtotal.toLocaleString()}`} />
                  <Row label="Shipping" value="Complimentary" />
                  <Row label="Tax (est.)" value={`$${tax.toLocaleString()}`} />
                </div>

                <div className="mt-6 pt-6 border-t border-gold/30 flex justify-between items-baseline">
                  <span className="text-[11px] tracking-luxury uppercase">Total</span>
                  <span className="font-display text-3xl text-gradient-gold">${total.toLocaleString()}</span>
                </div>

                <div className="mt-6 pt-6 border-t border-border space-y-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
                  <p className="inline-flex items-center gap-2"><Lock className="h-3 w-3 text-gold" /> 256-bit Encrypted Payment</p>
                  <p className="inline-flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-gold" /> Complimentary Insured Delivery</p>
                  <p className="inline-flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-gold" /> 30-Day Returns</p>
                </div>
              </div>
            </aside>
          </form>
        </div>
      </PageShell>

      <AnimatePresence>
        {placed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-midnight/85 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="relative max-w-md w-full bg-background border border-gold/40 shadow-[0_0_60px_rgba(212,175,55,0.45)] p-10 text-center"
            >
              <div className="absolute inset-0 bg-radial-gold opacity-30 pointer-events-none" />
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
                className="relative mx-auto h-20 w-20 rounded-full bg-gradient-gold grid place-items-center shadow-glow"
              >
                <CheckCircle2 className="h-10 w-10 text-midnight" />
              </motion.div>
              <p className="relative mt-6 text-[10px] tracking-wider-luxury text-gold">— Order Confirmed —</p>
              <h3 className="relative mt-4 font-display text-3xl text-gradient-gold">Thank you</h3>
              <p className="relative mt-4 font-serif italic text-muted-foreground">
                Your order has been placed successfully. A confirmation has been sent to your email.
              </p>
              <div className="relative mt-8 flex flex-col gap-3">
                <button
                  onClick={() => { clearCart(); navigate({ to: "/track-order" }); }}
                  className="bg-midnight text-frost px-8 py-3 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors"
                >
                  Track Your Order
                </button>
                <button
                  onClick={() => { clearCart(); navigate({ to: "/shop" }); }}
                  className="text-[11px] tracking-luxury uppercase text-muted-foreground hover:text-gold"
                >
                  Continue Shopping
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({ number, title, right, children }: { number: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-light p-8 md:p-10 border border-border">
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl text-gold">{number}</span>
          <h2 className="font-display text-2xl">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Floating({ label, value, onChange, type = "text", placeholder, required, className }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; className?: string }) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? " "}
        required={required}
        className="peer w-full bg-transparent border border-border px-4 pt-6 pb-3 text-sm outline-none focus:border-gold transition-all duration-300 placeholder-transparent"
      />
      <label className="pointer-events-none absolute left-4 top-2 text-[9px] tracking-luxury uppercase text-muted-foreground transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-xs peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:text-[9px] peer-focus:tracking-luxury peer-focus:uppercase peer-focus:text-gold">
        {label}
      </label>
    </div>
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
