import { motion } from "framer-motion";

export function PageShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`pt-28 pb-24 ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-navy text-frost">
      <div className="absolute inset-0 bg-radial-gold opacity-60" />
      <div className="film-grain relative mx-auto max-w-[1500px] px-6 lg:px-12 py-24 md:py-32 text-center">
        {eyebrow && <p className="text-[10px] tracking-wider-luxury uppercase text-gold mb-6">— {eyebrow} —</p>}
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-6 font-serif italic text-lg md:text-xl text-frost/70 max-w-2xl mx-auto">{subtitle}</p>}
      </div>
    </section>
  );
}

export default PageShell;
