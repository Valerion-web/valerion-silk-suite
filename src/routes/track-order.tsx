import { useState } from "react";
import { motion } from "framer-motion";
import { Package, Search, Truck, CheckCircle2, Sparkles } from "lucide-react";
import { PageHeader, PageShell } from "@/components/site/PageShell";

const STAGES = [
  { icon: Sparkles, label: "Order Confirmed", date: "Mar 14 · 10:24", status: "completed" },
  { icon: Package, label: "Crafted & Packed", date: "Mar 15 · 16:02", status: "completed" },
  { icon: Truck, label: "In Transit", date: "Mar 16 · 09:18", status: "completed" },
  { icon: Truck, label: "Out For Delivery", date: "Mar 17 · 08:15", status: "active" },
  { icon: CheckCircle2, label: "Delivered", date: "Awaiting", status: "pending" },
];

const shippingDetails = {
  courier: "Valerion Express",
  trackingNumber: "VLR-2217-8893",
  method: "Concierge Air Freight",
  estimatedArrival: "March 18, 2026 · by 8 PM",
  address: "22 Rue de la Paix, Paris, 75002, France",
};

function TrackOrderPage() {
  const [orderId, setOrderId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const progressIndex = STAGES.findIndex((stage) => stage.status === "active");
  const progressPercent = Math.round(((progressIndex + 1) / STAGES.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Concierge"
        title="Track Your Order"
        subtitle="Every Valerion piece is hand-finished. Follow its journey from our atelier to your wardrobe."
      />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-5xl px-6 mt-20">
          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative overflow-hidden rounded-[36px] border border-border bg-background p-6 shadow-card md:p-8"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <div className="grid gap-4 md:grid-cols-[1.4fr_0.9fr] items-end">
              <div>
                <label className="text-[10px] tracking-wider-luxury uppercase text-gold">Order Reference</label>
                <div className="mt-4 flex items-center gap-3 rounded-[24px] border border-border bg-background px-4 py-3 shadow-card">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="VLR-2026-XXXX"
                    className="flex-1 bg-transparent outline-none font-serif text-lg text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <div className="rounded-[28px] border border-border bg-background p-5 text-right shadow-card">
                <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Estimated Delivery</p>
                <p className="mt-3 text-2xl font-serif text-[#111827]">March 18, 2026</p>
                <p className="mt-2 text-sm text-muted-foreground">Arriving by 8 PM</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                className="rounded-full bg-gold px-8 py-3 text-[10px] tracking-wider-luxury uppercase text-midnight transition-transform duration-300 hover:-translate-y-0.5 hover:bg-[#E3B73B]"
              >
                Track
              </button>
              <p className="text-sm text-frost/60 font-serif">
                Enter your order reference to refresh the latest shipment status.
              </p>
            </div>
          </motion.form>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16 space-y-8"
            >
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
                <div className="rounded-[36px] border border-border bg-background p-8 shadow-card transition-all duration-300 ease-out hover:-translate-y-1">
                  <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Tracking Progress</p>
                      <p className="mt-3 text-3xl font-display text-foreground">{progressPercent}% Delivered Journey Completed</p>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background px-5 py-4 text-sm text-muted-foreground shadow-card">
                      <p className="uppercase tracking-[0.35em] text-muted-foreground">Next milestone</p>
                      <p className="mt-2 font-medium text-foreground">Out For Delivery</p>
                    </div>
                  </div>
                  <div className="mt-8 h-4 overflow-hidden rounded-full border border-border bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full shadow-[0_10px_30px_rgba(212,175,55,0.35)]"
                      style={{ background: "linear-gradient(90deg, #D4AF37, #E5C76B)" }}
                    />
                  </div>
                </div>

                <div className="rounded-[36px] border border-border bg-background p-8 shadow-card transition-all duration-300 ease-out hover:-translate-y-1">
                  <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Delivery Estimate</p>
                  <p className="mt-4 text-3xl font-serif text-foreground">March 18, 2026</p>
                  <p className="mt-2 text-sm text-muted-foreground">Arriving by 8 PM</p>
                  <div className="mt-6 rounded-[24px] border border-border bg-background p-5 shadow-card">
                    <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Address</p>
                    <p className="mt-2 text-sm text-foreground">{shippingDetails.address}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="rounded-[36px] border border-border bg-background p-8 shadow-card transition-all duration-300 ease-out hover:-translate-y-1">
                  <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Shipment Timeline</p>
                  <div className="relative mt-10">
                    <div className="absolute left-6 top-6 bottom-6 w-px bg-border" />
                    <div className="absolute left-6 top-6 w-px bg-gradient-to-b from-gold to-transparent" style={{ height: `${(progressIndex + 1) * 20 + 10}%` }} />
                    <div className="space-y-8">
                      {STAGES.map((stage, index) => {
                        const isCompleted = stage.status === "completed";
                        const isActive = stage.status === "active";
                        const iconClasses = isCompleted
                          ? "bg-gold border-gold text-midnight"
                          : isActive
                          ? "bg-background border-gold text-gold shadow-glow"
                          : "bg-muted border-border text-muted-foreground";

                        return (
                          <motion.div
                            key={stage.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 + index * 0.12 }}
                            className="relative flex items-start gap-6 pl-0"
                          >
                            <div className={`relative z-10 h-12 w-12 rounded-full grid place-items-center border ${iconClasses}`}>
                              <stage.icon className="h-5 w-5" />
                            </div>
                            <div className="pt-1">
                              <p className={`font-display text-xl ${isCompleted || isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                {stage.label}
                              </p>
                              <p className={isCompleted || isActive ? "mt-2 text-[10px] uppercase tracking-luxury text-muted-foreground" : "mt-2 text-[10px] uppercase tracking-luxury text-muted-foreground/70"}>
                                {stage.date}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-[36px] border border-border bg-background p-8 shadow-card transition-all duration-300 ease-out hover:-translate-y-1">
                  <p className="text-[10px] tracking-wider-luxury uppercase text-gold">Shipping Details</p>
                  <div className="mt-6 space-y-4 text-sm text-muted-foreground">
                    <div className="rounded-[24px] border border-border bg-background p-5 shadow-card">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Courier Partner</p>
                      <p className="mt-2 text-base text-foreground">{shippingDetails.courier}</p>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background p-5 shadow-card">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Tracking Number</p>
                      <p className="mt-2 text-base text-foreground">{shippingDetails.trackingNumber}</p>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background p-5 shadow-card">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Shipping Method</p>
                      <p className="mt-2 text-base text-foreground">{shippingDetails.method}</p>
                    </div>
                    <div className="rounded-[24px] border border-border bg-background p-5 shadow-card">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Estimated Arrival</p>
                      <p className="mt-2 text-base text-foreground">{shippingDetails.estimatedArrival}</p>
                    </div>
                  </div>
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
