import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import sceneSuit from "@/assets/scene-suit.jpg";
import sceneWalk from "@/assets/scene-walk.jpg";
import sceneFabric from "@/assets/scene-fabric.jpg";
import scenePortrait from "@/assets/scene-portrait.jpg";

const SCENES = [
  { src: heroImg, focal: "50% 35%", label: "The Atelier" },
  { src: sceneWalk, focal: "65% 50%", label: "The Runway" },
  { src: scenePortrait, focal: "60% 40%", label: "The Gentleman" },
  { src: sceneFabric, focal: "50% 55%", label: "The Cloth" },
  { src: sceneSuit, focal: "55% 50%", label: "The Tailoring" },
] as const;

const SCENE_DURATION = 5200; // ms per scene

export function CinematicHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  // ── Scroll-driven parallax ──
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yWaves = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const yScene = useTransform(scrollYProgress, [0, 1], ["0%", "26%"]);
  const yFog = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const yContent = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  // ── Cursor-reactive parallax (spring-smoothed) ──
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });
  const sceneX = useTransform(sx, (v) => v * -22);
  const sceneY = useTransform(sy, (v) => v * -14);
  const fogX = useTransform(sx, (v) => v * 38);
  const fogY = useTransform(sy, (v) => v * 24);
  const spotX = useTransform(sx, (v) => `${50 + v * 22}%`);
  const spotY = useTransform(sy, (v) => `${50 + v * 18}%`);
  const spotBg = useTransform(
    [spotX, spotY] as const,
    ([x, y]) =>
      `radial-gradient(38% 50% at ${x} ${y}, oklch(0.86 0.09 85 / 0.22), transparent 70%)`,
  );

  useEffect(() => {
    const node = ref.current;
    if (!node || reduce) return;
    const onMove = (e: MouseEvent) => {
      const r = node.getBoundingClientRect();
      mx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
      my.set(((e.clientY - r.top) / r.height - 0.5) * 2);
    };
    node.addEventListener("mousemove", onMove);
    return () => node.removeEventListener("mousemove", onMove);
  }, [mx, my, reduce]);

  // ── Scene auto-advance crossfade ──
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), SCENE_DURATION);
    return () => clearInterval(id);
  }, [reduce]);

  // ── Floating gold dust ──
  const particles = useMemo(
    () =>
      Array.from({ length: 32 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 1 + Math.random() * 3,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 14,
        drift: -20 + Math.random() * 40,
        opacity: 0.25 + Math.random() * 0.6,
      })),
    [],
  );

  const current = SCENES[index];

  return (
    <section
      ref={ref}
      className="relative h-screen min-h-[720px] w-full overflow-hidden bg-midnight isolate"
    >
      {/* ── Layer 1 · Slow navy gradient waves ── */}
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

      {/* ── Layer 2 · Crossfading cinematic scenes (the “fashion film”) ── */}
      <motion.div style={{ y: yScene, x: sceneX }} className="absolute inset-0 will-change-transform">
        <AnimatePresence mode="sync">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 1.18, filter: "blur(14px)" }}
            animate={{ opacity: 1, scale: 1.04, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.0, filter: "blur(8px)" }}
            transition={{
              opacity: { duration: 1.6, ease: [0.22, 1, 0.36, 1] },
              scale: { duration: SCENE_DURATION / 1000 + 1.6, ease: "linear" },
              filter: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
            }}
            className="absolute inset-0"
          >
            <img
              src={current.src}
              alt="House of Valerion — luxury menswear campaign"
              fetchPriority={index === 0 ? "high" : "low"}
              className="h-full w-full object-cover"
              style={{
                objectPosition: current.focal,
                filter: "contrast(1.1) saturate(1.05) brightness(0.92)",
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Cinematic edge vignette so scene focal points stay center-stage */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 75% at 50% 50%, transparent 50%, oklch(0.16 0.05 258 / 0.55) 88%, oklch(0.071 0.05 258 / 0.92) 100%)",
          }}
        />
      </motion.div>

      {/* ── Layer 3 · Cursor-reactive luxury spotlight ── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none mix-blend-soft-light"
        style={{ background: spotBg as unknown as string }}
      />

      {/* ── Layer 4 · Drifting fog (cursor + scroll) ── */}
      <motion.div
        style={{ y: yFog, x: fogX }}
        className="absolute inset-0 -z-0 pointer-events-none mix-blend-screen opacity-40"
      >
        <motion.div
          className="absolute -inset-[30%]"
          style={{
            y: fogY,
            background:
              "radial-gradient(40% 30% at 20% 70%, oklch(0.16 0.05 258 / 0.9), transparent 70%), radial-gradient(50% 40% at 80% 30%, oklch(0.22 0.07 260 / 0.6), transparent 75%)",
            filter: "blur(60px)",
          }}
          animate={reduce ? undefined : { x: ["-4%", "5%", "-4%"], y: ["3%", "-3%", "3%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      {/* ── Layer 5 · Glossy gold light sweep ── */}
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
                "linear-gradient(110deg, transparent 0%, oklch(0.86 0.09 85 / 0) 30%, oklch(0.86 0.09 85 / 0.55) 50%, oklch(0.86 0.09 85 / 0) 70%, transparent 100%)",
              filter: "blur(20px)",
            }}
          />
        </motion.div>
      )}

      {/* ── Layer 6 · Floating gold dust particles ── */}
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

      {/* ── Layer 7 · Vignette + grain + final wash ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-midnight/40 via-transparent to-midnight pointer-events-none" />
      <div className="film-grain absolute inset-0 pointer-events-none" />

      {/* ── Foreground content ── */}
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

        {/* Scene indicator — chapter dots & label */}
        <div className="absolute bottom-10 left-6 md:left-10 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {SCENES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Show scene ${i + 1}`}
                className="group relative h-px w-8 overflow-hidden bg-frost/20"
              >
                <motion.span
                  className="absolute inset-y-0 left-0 bg-gold"
                  initial={false}
                  animate={{ width: i === index ? "100%" : "0%" }}
                  transition={{
                    duration: i === index ? SCENE_DURATION / 1000 : 0.4,
                    ease: "linear",
                  }}
                />
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={current.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.6 }}
              className="text-[9px] tracking-luxury uppercase text-frost/60"
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.6 }}
          className="absolute bottom-10 right-6 md:right-10 flex flex-col items-center gap-2"
        >
          <span className="text-[9px] tracking-luxury uppercase text-frost/60">Scroll</span>
          <motion.div
            animate={{ y: [0, 10, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="h-12 w-px bg-gradient-to-b from-gold/80 to-transparent"
          />
        </motion.div>
      </motion.div>
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
            transition={{ duration: 1.2, delay: 0.9 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block"
            style={{ whiteSpace: "pre" }}
          >
            {ch === " " ? "\u00A0" : ch}
          </motion.span>
        ))}
      </span>
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
        transition={{
          duration: 4.5,
          repeat: Infinity,
          repeatDelay: 3.5,
          ease: "easeInOut",
          delay: 2.2,
        }}
      >
        {text}
      </motion.span>
    </span>
  );
}
