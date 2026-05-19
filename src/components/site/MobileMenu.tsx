import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

export function MobileMenu({ onClose, links }: { onClose: () => void; links: { to: string; label: string }[] }) {
  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[60] bg-midnight text-frost flex flex-col p-8"
    >
      <div className="flex justify-between items-center">
        <span className="font-display tracking-[0.14em]">VALERION</span>
        <button onClick={onClose} aria-label="Close"><X className="h-6 w-6" /></button>
      </div>
      <nav className="mt-16 flex flex-col gap-6">
        {links.map((l, i) => (
          <motion.div
            key={l.to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
          >
            <Link to={l.to} onClick={onClose} className="font-display text-4xl hover:text-gold transition-colors">
              {l.label}
            </Link>
          </motion.div>
        ))}
      </nav>
      <div className="mt-auto text-[10px] tracking-luxury uppercase text-frost/50">
        © House of Valerion · Crafted in Milano
      </div>
    </motion.div>
  );
}

export default MobileMenu;
