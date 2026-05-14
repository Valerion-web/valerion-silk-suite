import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useMemo, useRef } from "react";
import { ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export function CinematicHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  // Layered parallax — back layers move slower than front layers
  const yWaves = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const yModel = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const yFog = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const scaleModel = useTransform(scrollYProgress, [0, 1], [1, 1.08]);

  // Floating gold dust — generated once
  const particles = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 3,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 14,
        drift: -20 + Math.random() * 40,
        opacity: 0.25 + Math.random() * 0.55,
      })),
    []
  );

  return (
    <section
      ref={ref}
      className="relative h-screen min-h-[720px] w-full overflow-hidden bg-midnight isolate"
    >
      {/* ───── Layer 1 · Slow navy gradient waves ───── */}
      <motion.div style={{ y: yWaves }} className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-navy" />
        <motion.div
          aria-hidden
          className="absolute -inset-[20%] opacity-70"
          style={{
            background:
              "radial-gradient(60% 50% at 30% 40%, oklch(0.36 0.14 264 / 0.55), transparent 60%), radial-gradient(50% 45% at 75% 65%, oklch(0.22 0.07 260 / 0.7), transparent 65%)",
            filter: "blur(40px)",
          }}
          animate={
            reduce
              ? undefined
              : { x: ["-3%", "3%", "-3%"], y: ["2%", "-2%", "2%"], rotate: [0, 4, 0] }
          }
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* ───── Layer 2 · Dark drifting fog ───── */}
      <motion.div
        style={{ y: yFog }}
        className="absolute inset-0 -z-10 pointer-events-none mix-blend-screen opacity-40"
      >
        <motion.div
          className="absolute -inset-[30%]"
          style={{
            background:
              "radial-gradient(40% 30% at 20% 70%, oklch(0.16 0.05 258 / 0.9), transparent 70%), radial-gradient(50% 40% at 80% 30%, oklch(0.22 0.07 260 / 0.6), transparent 75%)",
            filter: "blur(60px)",
          }}
          animate={reduce ? undefined : { x: ["-4%", "5%", "-4%"], y: ["3%", "-3%", "3%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* ───── Layer 3 · Hero model — slow cinematic zoom + breathing ───── */}
      <motion.div
        style={{ y: yModel, scale: scaleModel }}
        initial={{ scale: 1.12, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 will-change-transform"
      >
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { scale: [1, 1.018, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={heroImg}
            alt="House of Valerion — luxury menswear campaign"
            fetchPriority="high"
            className="h-full w-full object-cover"
            style={{ filter: "contrast(1.08) saturate(1.05)" }}
          />
          {/* soft reflective highlight on suit fabric */}
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-soft-light opacity-60"
            style={{
              background:
                "radial-gradient(45% 60% at 50% 45%, oklch(0.985 0.005 250 / 0.35), transparent 70%)",
            }}
          />
          {/* depth blur ring — keeps model sharp, blurs edges */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 70% at 50% 50%, transparent 55%, oklch(0.16 0.05 258 / 0.55) 100%)",
              backdropFilter: "blur(0px)",
            }}
          />
        </motion.div>
      </motion.div>

      {/* ───── Layer 4 · Cinematic gold light sweep across blazer ───── */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none mix-blend-overlay"
          initial={{ x: "-120%" }}
          animate={{ x: ["-120%", "120%"] }}
          transition={{ duration: 7, repeat: Infinity, repeatDelay: 4, ease: [0.65, 0, 0.35, 1] }}
        >
          <div
            className="h-full w-1/3"
            style={{
              background:
                "linear-gradient(110deg, transparent 0%, oklch(0.86 0.09 85 / 0.0) 30%, oklch(0.86 0.09 85 / 0.55) 50%, oklch(0.86 0.09 85 / 0.0) 70%, transparent 100%)",
              filter: "blur(20px)",
            }}
          />
        </motion.div>
      )}

      {/* ───── Layer 5 · Floating gold dust particles ───── */}
      {!reduce && (
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: p.size,
                height: p.size,
                background:
                  "radial-gradient(circle, oklch(0.86 0.09 85 / 0.95) 0%, oklch(0.78 0.13 85 / 0.4) 50%, transparent 70%)",
                boxShadow: "0 0 6px oklch(0.86 0.09 85 / 0.6)",
              }}
              animate={{
                y: [0, -60 - Math.random() * 40, 0],
                x: [0, p.drift, 0],
                opacity: [0, p.opacity, 0],
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* ───── Layer 6 · Vignette + grain ───── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, oklch(0.071 0.05 258 / 0.55) 85%, oklch(0.071 0.05 258 / 0.85) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-midnight/40 via-transparent to-midnight pointer-events-none" />
      <div className="film-grain absolute inset-0 pointer-events-none" />

      {/* ───── Foreground content ───── */}
      <motion.div
        style={{ opacity, y: yContent }}
        className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6"
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.2em" }}
          animate={{ opacity: 1, letterSpacing: "0.5em" }}
          transition={{ duration: 1.4, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-[10px] md:text-xs uppercase text-gold mb-8"
        >
          — Autumn Atelier · MMXXVI —
        </motion.p>

        {/* HOUSE OF VALERION — letter-by-letter reveal with gold shimmer */}
        <h1 className="font-display text-frost text-5xl md:text-7xl lg:text-8xl leading-[1] max-w-5xl">
          <span className="sr-only">House of Valerion</span>
          <ShimmerHeading text="HOUSE OF VALERION" />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.6, delay: 1.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 max-w-xl font-serif italic text-frost/80 text-lg md:text-xl"
        >
          Crafted for modern gentlemen who value timeless elegance, confidence, and refined sophistication.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 2 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <Link
            to="/shop"
            className="group relative inline-flex items-center justify-center gap-3 bg-frost text-midnight px-9 py-4 text-[11px] tracking-luxury uppercase font-medium overflow-hidden transition-all duration-500 hover:bg-gold hover:shadow-glow"
          >
            <span className="relative z-10 inline-flex items-center gap-3">
              Explore Collection
              <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </span>
            <span
              aria-hidden
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gold/60 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </Link>
          <Link
            to="/shop"
            className="group relative inline-flex items-center justify-center gap-3 border border-frost/40 text-frost px-9 py-4 text-[11px] tracking-luxury uppercase font-medium transition-all duration-500 hover:border-gold hover:text-gold hover:shadow-glow"
          >
            New Arrivals
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] tracking-luxury uppercase text-frost/60">Scroll</span>
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="h-12 w-px bg-gradient-to-b from-gold/80 to-transparent"
          />
        </motion.div>
      </motion.div>

      {/* Soft moving shadow beneath the model */}
      <motion.div
        aria-hidden
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-24 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.071 0.05 258 / 0.7) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
        animate={reduce ? undefined : { scaleX: [1, 1.05, 1], opacity: [0.7, 0.9, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
    </section>
  );
}

function ShimmerHeading({ text }: { text: string }) {
  const letters = Array.from(text);
  return (
    <span aria-hidden className="relative inline-block">
      <span className="relative inline-flex flex-wrap justify-center">
        {letters.map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
              duration: 1.2,
              delay: 0.9 + i * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="inline-block"
            style={{ whiteSpace: "pre" }}
          >
            {ch === " " ? "\u00A0" : ch}
          </motion.span>
        ))}
      </span>
      {/* Gold shimmer sweep across the title */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-clip-text text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(110deg, transparent 35%, oklch(0.86 0.09 85 / 0.95) 50%, transparent 65%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
        }}
        initial={{ backgroundPosition: "200% 0%" }}
        animate={{ backgroundPosition: ["200% 0%", "-100% 0%"] }}
        transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 3.5, ease: "easeInOut", delay: 2.2 }}
      >
        {text}
      </motion.span>
    </span>
  );
}
