import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DrawerProps {
  open: boolean;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}

export default function Drawer({ open, children, onClose, width = "24rem" }: DrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-50 flex bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="flex-1" onClick={onClose} aria-label="Close drawer" />
          <motion.div
            className="h-full bg-white shadow-[0_0_60px_rgba(15,23,42,0.25)]"
            style={{ width }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
