import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  scrollable?: boolean;
}

export default function Modal({ open, title, children, onClose, footer, scrollable = false }: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ${scrollable ? "overflow-hidden overscroll-none" : ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`w-full max-w-2xl rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-[0_40px_80px_-35px_rgba(15,23,42,0.3)] ${scrollable ? "flex max-h-[90vh] flex-col" : ""}`}
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className={`mb-4 flex items-start justify-between gap-4 ${scrollable ? "shrink-0" : ""}`}>
              <div>
                {title ? <h3 className="text-xl font-semibold text-[#0F172A]">{title}</h3> : null}
              </div>
              <button type="button" onClick={onClose} className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A]">
                Close
              </button>
            </div>
            <div className={scrollable ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}>{children}</div>
            {footer ? <div className={`mt-6 border-t border-[#E5E7EB] pt-4 ${scrollable ? "shrink-0" : ""}`}>{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
