import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import storyImg from "@/assets/story.jpg";
import experienceImg from "@/assets/experience.jpg";
import suitsImg from "@/assets/collection-suits.jpg";
import { PageShell, PageHeader } from "@/components/site/PageShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "The Atelier — House of Valerion" },
      { name: "description", content: "Three generations of Milanese tailoring. Discover the philosophy behind House of Valerion." },
      { property: "og:title", content: "The Atelier — House of Valerion" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <PageHeader eyebrow="The Maison" title="A House of Quiet Conviction" subtitle="Since 1968, dressing the men who shape their worlds." />
      <PageShell className="pt-0">

        <section className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-24 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <img src={storyImg} alt="Atelier" className="h-full w-full object-cover" />
          </motion.div>
          <div>
            <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— Our Philosophy —</p>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">
              Restraint is the <em className="text-gradient-gold not-italic font-serif">highest</em> luxury.
            </h2>
            <div className="mt-8 space-y-5 font-serif text-lg leading-relaxed text-muted-foreground">
              <p>House of Valerion was founded in a small atelier off the Via Montenapoleone by Giovanni Valerion, a tailor who believed that true elegance speaks softly.</p>
              <p>Three generations later, that philosophy has not moved an inch. We do not chase trends. We refine archetypes — the suit, the shirt, the coat — until they become quietly extraordinary.</p>
            </div>
          </div>
        </section>

        <section className="mt-32 bg-gradient-navy text-frost py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gold opacity-50" />
          <div className="film-grain absolute inset-0" />
          <div className="relative mx-auto max-w-[1300px] px-6 lg:px-12">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— Three Pillars —</p>
              <h2 className="font-display text-4xl md:text-5xl">The Way We Build a Garment</h2>
            </div>
            <div className="mt-16 grid md:grid-cols-3 gap-8">
              {[
                { n: "01", t: "Fabric", d: "We source only from the world's finest mills — Loro Piana, Vitale Barberis, Zegna. Wool, cashmere, silk and cotton at the very top of their craft." },
                { n: "02", t: "Cut", d: "Every pattern is hand-drafted by master cutters. The shoulder, the lapel, the rise — each line considered for the modern silhouette." },
                { n: "03", t: "Finish", d: "Hand-stitched buttonholes. Pick-stitched lapels. Linings cut from the same care as the cloth. Time, taken." },
              ].map((p, i) => (
                <motion.div
                  key={p.n}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: i * 0.1 }}
                  className="glass p-9"
                >
                  <p className="font-display text-gold text-5xl">{p.n}</p>
                  <h3 className="mt-4 font-display text-2xl">{p.t}</h3>
                  <p className="mt-4 font-serif italic text-frost/70 leading-relaxed">{p.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-32 grid lg:grid-cols-2 gap-16 items-center">
          <div className="lg:order-2 relative aspect-[4/5] overflow-hidden">
            <img src={suitsImg} alt="Tailoring" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— The Modern Gentleman —</p>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">A wardrobe for men who write their own story.</h2>
            <p className="mt-8 font-serif text-lg leading-relaxed text-muted-foreground">
              Our client is not loud. He is considered. He understands that a well-cut suit does not announce itself — it simply belongs. We dress entrepreneurs, architects, conductors, and creators. Men who choose carefully.
            </p>
            <Link to="/shop" className="mt-10 inline-flex items-center gap-3 bg-midnight text-frost px-9 py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors">
              Discover the Collection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-32 relative h-[60vh] min-h-[500px] overflow-hidden">
          <img src={experienceImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-midnight/60" />
          <div className="film-grain absolute inset-0" />
          <div className="relative h-full grid place-items-center text-center text-frost px-6">
            <motion.blockquote
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="max-w-3xl"
            >
              <p className="font-display italic text-3xl md:text-5xl leading-[1.2]">
                "We do not make clothes. We compose silhouettes a man can build a life inside of."
              </p>
              <footer className="mt-8 text-[10px] tracking-luxury uppercase text-gold">— Lorenzo Valerion, Creative Director</footer>
            </motion.blockquote>
          </div>
        </section>
      </PageShell>
    </>
  );
}
