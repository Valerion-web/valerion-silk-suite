;
import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Search, Truck, CheckCircle2, Sparkles } from "lucide-react";
import { PageHeader, PageShell } from "@/components/site/PageShell";



const STAGES = [
  { icon: Sparkles, label: "Order Confirmed", date: "Mar 14 · 10:24" },
  { icon: Package, label: "Crafted & Packed", date: "Mar 15 · 16:02" },
  { icon: Truck, label: "In Transit", date: "Mar 16 · 09:18", active: true },
  { icon: CheckCircle2, label: "Delivered", date: "Awaiting" },
];

function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Concierge"
        title="Track Your Order"
        subtitle="Every Valerion piece is hand-finished. Follow its journey from our atelier to your wardrobe."
      />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-3xl px-6 mt-20">
          <motion.form
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative bg-card border border-border p-8 md:p-10 shadow-card"
          >
            <div className="absolute -top-px inset-x-8 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <label className="text-[10px] tracking-wider-luxury uppercase text-gold">Order Reference</label>
            <div className="mt-4 flex items-center gap-3 border-b border-border pb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="VLR-2026-XXXX"
                className="flex-1 bg-transparent outline-none font-serif text-xl placeholder:text-muted-foreground/50"
              />
              <button type="submit" className="bg-midnight text-frost text-[10px] tracking-luxury uppercase px-6 py-3 hover:bg-gold hover:text-midnight transition-colors">
                Track
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground font-serif italic">
              Find your reference in the confirmation email signed by our concierge team.
            </p>
          </motion.form>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16"
            >
              <div className="flex items-baseline justify-between mb-10">
                <div>
                  <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Reference</p>
                  <p className="font-display text-2xl mt-1">{orderId || "VLR-2026-0421"}</p>
                </div>
                <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">Estimated Mar 18</p>
              </div>

              <div className="relative">
                <div className="absolute left-6 top-6 bottom-6 w-px bg-border" />
                <div className="absolute left-6 top-6 w-px bg-gradient-to-b from-gold to-transparent" style={{ height: "55%" }} />
                <div className="space-y-8">
                  {STAGES.map((s, i) => {
                    const Icon = s.icon;
                    const done = i < 2;
                    const active = i === 2;
                    return (
                      <motion.div
                        key={s.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.15 }}
                        className="relative flex items-start gap-6 pl-0"
                      >
                        <div className={`relative z-10 h-12 w-12 rounded-full grid place-items-center border ${
                          done ? "bg-gold border-gold text-midnight" :
                          active ? "bg-midnight border-gold text-gold shadow-glow" :
                          "bg-background border-border text-muted-foreground"
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="pt-2">
                          <p className={`font-display text-xl ${active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                            {s.label}
                          </p>
                          <p className="text-[10px] tracking-luxury uppercase text-muted-foreground mt-1">{s.date}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </PageShell>
    </>
  );
}

export default TrackOrderPage;
