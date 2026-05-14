import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight, Star } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import storyImg from "@/assets/story.jpg";
import experienceImg from "@/assets/experience.jpg";
import { collections, products } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";
import { SectionHeading } from "@/components/site/SectionHeading";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <FeaturedCollections />
      <NewArrivals />
      <BrandStory />
      <ExperienceBanner />
      <Testimonials />
      <Gallery />
      <Newsletter />
    </>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const yMid = useTransform(scrollYProgress, [0, 1], ["0%", "32%"]);
  const yFog = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "55%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.06]);

  const particles = useRef(
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: -10 - Math.random() * 20,
      size: 1.5 + Math.random() * 3.5,
      duration: 12 + Math.random() * 14,
      delay: -Math.random() * 20,
      drift: -30 + Math.random() * 60,
    }))
  ).current;

  const title = "HOUSE OF VALERION";

  return (
    <section ref={ref} className="relative h-screen min-h-[760px] w-full overflow-hidden bg-midnight">
      {/* Slow navy gradient waves */}
      <div className="absolute inset-0 bg-midnight">
        <div className="navy-wave" />
        <div className="navy-wave delay" />
      </div>

      {/* Drifting smoke / fog */}
      <motion.div style={{ y: yFog }} className="absolute inset-0">
        <div className="smoke-fog" />
      </motion.div>

      {/* Hero image — breathing zoom + parallax + studio light */}
      <motion.div style={{ y: yBg, scale: heroScale }} className="absolute inset-0">
        <div className="hero-breathe absolute inset-0">
          <img
            src={heroImg}
            alt="House of Valerion luxury menswear hero"
            fetchPriority="high"
            className="h-full w-full object-cover object-center"
          />
        </div>
        <motion.div
          aria-hidden
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 30% 35%, oklch(0.95 0.05 85 / 0.18), transparent 45%)",
              "radial-gradient(circle at 60% 30%, oklch(0.95 0.05 85 / 0.22), transparent 45%)",
              "radial-gradient(circle at 45% 50%, oklch(0.95 0.05 85 / 0.14), transparent 45%)",
              "radial-gradient(circle at 30% 35%, oklch(0.95 0.05 85 / 0.18), transparent 45%)",
            ],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="light-sweep" />
        <motion.div
          aria-hidden
          className="absolute inset-0 mix-blend-soft-light"
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(ellipse 40% 25% at 42% 38%, oklch(1 0 0 / 0.5), transparent 70%)",
          }}
        />
      </motion.div>

      {/* Ground shadow */}
      <motion.div style={{ y: yMid }} className="absolute inset-0 pointer-events-none">
        <div className="ground-shadow" />
      </motion.div>

      <div className="absolute inset-0 bg-gradient-to-b from-midnight/55 via-midnight/15 to-midnight pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gold opacity-30 pointer-events-none" />

      {/* Floating gold dust */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <span
            key={p.id}
            className="gold-particle"
            style={
              {
                left: `${p.left}%`,
                bottom: `${p.bottom}%`,
                ["--s" as string]: `${p.size}px`,
                ["--d" as string]: `${p.duration}s`,
                ["--delay" as string]: `${p.delay}s`,
                ["--dx" as string]: `${p.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="film-grain absolute inset-0 pointer-events-none" />
      <div className="vignette" />

      <motion.div
        style={{ opacity, y: yContent }}
        className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6"
      >
        <motion.p
          initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-[10px] md:text-xs tracking-wider-luxury uppercase text-gold mb-8"
        >
          — Autumn Atelier · MMXXVI —
        </motion.p>

        <h1 className="font-display text-frost text-5xl md:text-7xl lg:text-[7.5rem] leading-[0.95] max-w-6xl">
          <span className="sr-only">{title}</span>
          <motion.span
            aria-hidden
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.045, delayChildren: 0.6 }}
            className="text-shimmer-gold inline-block"
            style={{ letterSpacing: "0.02em" }}
          >
            {title.split("").map((ch, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 40, filter: "blur(12px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block"
              >
                {ch === " " ? "\u00A0" : ch}
              </motion.span>
            ))}
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.4, delay: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-xl font-serif italic text-frost/85 text-lg md:text-xl"
        >
          Crafted for modern gentlemen who value timeless elegance, confidence, and refined sophistication.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.9 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <Link
            to="/shop"
            className="hero-cta-glow group inline-flex items-center justify-center gap-3 bg-frost text-midnight px-9 py-4 text-[11px] tracking-luxury uppercase font-medium hover:bg-gold transition-colors duration-500"
          >
            Explore Collection
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/shop"
            className="hero-cta-glow inline-flex items-center justify-center gap-3 border border-frost/40 text-frost px-9 py-4 text-[11px] tracking-luxury uppercase font-medium hover:border-gold hover:text-gold transition-colors duration-500"
          >
            New Arrivals
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.4 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] tracking-luxury uppercase text-frost/60">Scroll</span>
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
            className="h-12 w-px bg-gradient-to-b from-gold/80 to-transparent"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

function FeaturedCollections() {
  return (
    <section className="py-24 md:py-32 mx-auto max-w-[1500px] px-6 lg:px-12">
      <SectionHeading eyebrow="The Collections" title="Crafted in Six Chapters" subtitle="Each silhouette is a study in restraint, designed for men who write their own legacy." />

      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {collections.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to="/shop" className="group block relative overflow-hidden hover-zoom-parent aspect-[4/5]">
              <img src={c.image} alt={c.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover hover-zoom-img" />
              <div className="absolute inset-0 bg-gradient-overlay" />
              <div className="absolute inset-0 p-8 flex flex-col justify-end text-frost">
                <p className="text-[10px] tracking-luxury uppercase text-gold mb-2">{c.count} Pieces</p>
                <h3 className="font-display text-3xl md:text-4xl">{c.title}</h3>
                <span className="mt-4 inline-flex items-center gap-2 text-[11px] tracking-luxury uppercase opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                  Discover <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function NewArrivals() {
  return (
    <section className="py-24 md:py-32 bg-secondary/30">
      <div className="mx-auto max-w-[1500px] px-6 lg:px-12">
        <div className="flex items-end justify-between gap-8 flex-wrap">
          <SectionHeading align="left" eyebrow="New Arrivals" title="The Season's Edit" />
          <Link to="/shop" className="text-[11px] tracking-luxury uppercase link-underline text-gold">View All</Link>
        </div>
        <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {products.slice(0, 4).map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BrandStory() {
  return (
    <section className="py-24 md:py-32 mx-auto max-w-[1500px] px-6 lg:px-12">
      <div className="grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative aspect-[4/5] overflow-hidden hover-zoom-parent"
        >
          <img src={storyImg} alt="Atelier craftsmanship" loading="lazy" className="absolute inset-0 h-full w-full object-cover hover-zoom-img" />
          <div className="absolute -bottom-6 -right-6 bg-gold text-midnight px-8 py-6 font-display text-2xl shadow-luxury hidden md:block">
            Est. <span className="font-serif italic">1968</span>
          </div>
        </motion.div>

        <div>
          <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— The Maison —</p>
          <h2 className="font-display text-4xl md:text-6xl leading-[1.05]">
            Heritage in <em className="text-gradient-gold not-italic font-serif">every</em> stitch.
          </h2>
          <div className="mt-8 space-y-5 text-muted-foreground leading-relaxed text-lg font-serif">
            <p>
              For three generations, the House of Valerion has dressed the world's most considered men. Our atelier in Milano blends traditional Italian tailoring with a contemporary sensibility — quietly confident, never loud.
            </p>
            <p>
              Each garment is cut from the most exceptional fibres in the world: Loro Piana wool, Mongolian cashmere, Sea Island cotton. Hand-finished by master tailors who carry decades of craft in their fingertips.
            </p>
          </div>
          <Link to="/about" className="mt-10 inline-flex items-center gap-3 text-[11px] tracking-luxury uppercase link-underline">
            Discover the Maison <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function ExperienceBanner() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-15%", "15%"]);

  return (
    <section ref={ref} className="relative h-[80vh] min-h-[600px] overflow-hidden bg-midnight">
      <motion.div style={{ y }} className="absolute inset-0">
        <img src={experienceImg} alt="Luxury experience" loading="lazy" className="h-full w-full object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/60 to-transparent" />
      <div className="film-grain absolute inset-0" />
      <div className="relative h-full flex items-center mx-auto max-w-[1500px] px-6 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="max-w-xl"
        >
          <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— A Cinematic Experience —</p>
          <h2 className="font-display text-frost text-4xl md:text-6xl lg:text-7xl leading-[1.05]">
            Dress with <em className="text-gradient-gold not-italic font-serif">intention.</em>
          </h2>
          <p className="mt-6 font-serif italic text-frost/70 text-lg md:text-xl">
            The wardrobe of a man who knows exactly who he is — and who he is becoming.
          </p>
          <Link to="/shop" className="mt-10 inline-flex items-center gap-3 bg-gold text-midnight px-9 py-4 text-[11px] tracking-luxury uppercase font-medium hover:bg-frost transition-colors duration-500">
            Begin the Journey <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

const testimonials = [
  { quote: "Valerion is the only house that understands the language of restraint. Every suit feels like it was made twice.", name: "Alessandro V.", role: "Creative Director, Milano" },
  { quote: "I have travelled the world in their tailoring. There is nothing comparable in fit, fabric, or finish.", name: "Daniel R.", role: "Founder & CEO" },
  { quote: "The cashmere is impossibly soft. The cut is impeccable. The experience — quietly extraordinary.", name: "Marcus L.", role: "Architect, London" },
];

function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-gradient-navy text-frost relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold opacity-50" />
      <div className="film-grain absolute inset-0" />
      <div className="relative mx-auto max-w-[1500px] px-6 lg:px-12">
        <SectionHeading light eyebrow="Words from the House" title="Spoken by Gentlemen" />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              className="glass p-9 hover:border-gold/40 transition-colors duration-500"
            >
              <div className="flex gap-1 text-gold mb-6">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} className="h-3 w-3 fill-current" />)}
              </div>
              <p className="font-serif italic text-lg leading-relaxed text-frost/90">"{t.quote}"</p>
              <div className="mt-8 pt-6 border-t border-frost/10">
                <p className="font-display text-lg">{t.name}</p>
                <p className="text-[10px] tracking-luxury uppercase text-gold mt-1">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  const imgs = [collections[0].image, collections[2].image, collections[3].image, collections[5].image, collections[1].image, collections[4].image];
  return (
    <section className="py-24 md:py-32 mx-auto max-w-[1500px] px-6 lg:px-12">
      <SectionHeading eyebrow="@HouseOfValerion" title="Editorial Diary" subtitle="Moments from the atelier and the men who wear it." />
      <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {imgs.map((src, i) => (
          <motion.a
            key={i}
            href="#"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
            className={`relative overflow-hidden hover-zoom-parent ${i % 5 === 0 ? "row-span-2 aspect-[3/5]" : "aspect-square"}`}
          >
            <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover hover-zoom-img" />
            <div className="absolute inset-0 bg-midnight/0 hover:bg-midnight/40 transition-colors duration-500" />
          </motion.a>
        ))}
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="relative py-24 md:py-32 bg-midnight text-frost overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold opacity-40" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— Private Correspondence —</p>
        <h2 className="font-display text-4xl md:text-6xl leading-[1.05]">Join the Inner Circle</h2>
        <p className="mt-6 font-serif italic text-frost/70 text-lg">
          First access to new collections, private events, and the Valerion editorial.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-10 glass p-2 flex flex-col sm:flex-row gap-2 max-w-xl mx-auto"
        >
          <input
            type="email"
            placeholder="Your private email"
            className="flex-1 bg-transparent px-5 py-4 text-frost placeholder:text-frost/40 outline-none text-sm"
          />
          <button className="bg-gold text-midnight px-8 py-4 text-[11px] tracking-luxury uppercase font-medium hover:bg-frost transition-colors duration-500">
            Subscribe
          </button>
        </form>
        <p className="mt-6 text-[10px] tracking-luxury uppercase text-frost/40">No noise. Only craft.</p>
      </div>
    </section>
  );
}
