import { motion } from "framer-motion";
import { Ruler, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

const sizeData = [
  { size: "XS", chest: "86 - 91", waist: "71 - 76", hip: "86 - 91", neck: "36", sleeve: "81" },
  { size: "S",  chest: "91 - 96", waist: "76 - 81", hip: "91 - 96", neck: "38", sleeve: "82" },
  { size: "M",  chest: "96 - 101", waist: "81 - 86", hip: "96 - 101", neck: "40", sleeve: "84" },
  { size: "L",  chest: "101 - 106", waist: "86 - 91", hip: "101 - 106", neck: "42", sleeve: "85" },
  { size: "XL", chest: "106 - 111", waist: "91 - 96", hip: "106 - 111", neck: "44", sleeve: "86" },
  { size: "XXL", chest: "111 - 118", waist: "96 - 103", hip: "111 - 118", neck: "46", sleeve: "87" },
];

const inchesData = sizeData.map((r) => ({
  ...r,
  chest: cmRangeToIn(r.chest),
  waist: cmRangeToIn(r.waist),
  hip: cmRangeToIn(r.hip),
  neck: String(Math.round(Number(r.neck) / 2.54)),
  sleeve: String(Math.round(Number(r.sleeve) / 2.54)),
}));

function cmRangeToIn(range: string) {
  return range
    .split("-")
    .map((n) => Math.round(Number(n.trim()) / 2.54))
    .join(" - ");
}

export function SizeGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const rows = unit === "cm" ? sizeData : inchesData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl border-border/60 bg-background p-0 overflow-hidden [&>button]:hidden"
      >
        <div className="relative">
          {/* Header */}
          <div className="relative bg-gradient-to-br from-midnight via-midnight to-midnight/90 text-cream px-8 pt-10 pb-8 overflow-hidden">
            <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_30%_20%,#D4AF37,transparent_60%)]" />
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 h-9 w-9 grid place-items-center rounded-full border border-white/15 text-cream/80 hover:text-cream hover:border-gold/60 transition"
              aria-label="Close size guide"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-[10px] tracking-luxury uppercase text-gold">
              <Ruler className="h-3.5 w-3.5" /> The Atelier
            </div>
            <DialogTitle asChild>
              <h2 className="font-display text-3xl md:text-4xl mt-3 leading-tight">
                Size Guide
              </h2>
            </DialogTitle>
            <p className="mt-2 text-sm text-cream/70 max-w-lg">
              Every Valerion piece is cut to a refined modern fit. Measurements
              indicate body dimensions, not garment dimensions.
            </p>

            {/* Unit toggle */}
            <div className="mt-6 inline-flex border border-white/15 rounded-full overflow-hidden text-[10px] tracking-luxury uppercase">
              {(["cm", "in"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-5 py-2 transition ${
                    unit === u
                      ? "bg-gold text-midnight"
                      : "text-cream/70 hover:text-cream"
                  }`}
                >
                  {u === "cm" ? "Centimetres" : "Inches"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="px-8 py-8 max-h-[55vh] overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-[10px] tracking-luxury uppercase text-muted-foreground">
                    {["Size", "Chest", "Waist", "Hip", "Neck", "Sleeve"].map((h) => (
                      <th key={h} className="text-left font-normal py-3 border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.size}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="group border-b border-border/60 hover:bg-muted/30 transition"
                    >
                      <td className="py-4 font-display text-lg text-foreground group-hover:text-gold transition">
                        {r.size}
                      </td>
                      <td className="py-4 text-foreground/80">{r.chest}</td>
                      <td className="py-4 text-foreground/80">{r.waist}</td>
                      <td className="py-4 text-foreground/80">{r.hip}</td>
                      <td className="py-4 text-foreground/80">{r.neck}</td>
                      <td className="py-4 text-foreground/80">{r.sleeve}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* How to measure */}
            <div className="mt-8 grid sm:grid-cols-3 gap-6">
              {[
                { t: "Chest", d: "Measure around the fullest part of the chest, keeping the tape level." },
                { t: "Waist", d: "Measure around the natural waistline, just above the hip bones." },
                { t: "Sleeve", d: "From the centre back of the neck, across the shoulder to the wrist." },
              ].map((m) => (
                <div key={m.t} className="border-l border-gold/40 pl-4">
                  <p className="text-[10px] tracking-luxury uppercase text-gold">{m.t}</p>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{m.d}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-[11px] text-muted-foreground italic">
              Between sizes? We recommend the larger size for a relaxed silhouette,
              or contact our concierge for bespoke tailoring.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SizeGuide;
