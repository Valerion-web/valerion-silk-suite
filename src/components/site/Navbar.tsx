import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, Menu, ChevronDown } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { MobileMenu } from "./MobileMenu";
import { ProfileMenu } from "./ProfileMenu";
import { useShop } from "@/lib/store";
import { collections } from "@/lib/products";

const links = [
  { to: "/shop", label: "Shop", mega: "shop" as const },
  { to: "/category", label: "Collection", mega: "collection" as const },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Track Order" },
];

const shopMenu = [
  { label: "New Arrivals", to: "/shop", search: "new" },
  { label: "Best Sellers", to: "/shop", search: "best" },
  { label: "Premium Shirts", to: "/category/premium-shirts" },
  { label: "Ethnic Wear", to: "/category/ethnic-wear" },
  { label: "Formal Wear", to: "/category/modern-formalwear" },
  { label: "Accessories", to: "/category/accessories" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverMega, setHoverMega] = useState<"shop" | "collection" | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cartCount, wishCount } = useShop();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Always dark navy navbar now
  const onDark = true;

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-x-0 top-0 z-50 transition-all duration-700"
        style={{
          background: scrolled
            ? "linear-gradient(180deg, oklch(0.13 0.05 258 / 0.92) 0%, oklch(0.10 0.05 258 / 0.88) 100%)"
            : "linear-gradient(180deg, oklch(0.13 0.05 258 / 0.78) 0%, oklch(0.10 0.05 258 / 0.55) 100%)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: scrolled ? "1px solid oklch(0.78 0.13 85 / 0.28)" : "1px solid oklch(0.78 0.13 85 / 0.12)",
          boxShadow: scrolled
            ? "0 12px 40px -10px oklch(0 0 0 / 0.5), 0 1px 0 oklch(0.78 0.13 85 / 0.1) inset"
            : "0 6px 24px -8px oklch(0 0 0 / 0.4)",
        }}
        onMouseLeave={() => setHoverMega(null)}
        key={pathname}
      >
        <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-6 lg:px-12">
          {/* LEFT — LOGO */}
          <Link to="/" className="group flex items-center shrink-0">
            <div className="leading-none">
              <div className="text-[8px] md:text-[9px] tracking-wider-luxury mb-1 text-gold/80">
                HOUSE OF
              </div>
              <motion.div
                whileHover={{ letterSpacing: "0.22em" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative font-display text-2xl md:text-[28px] tracking-[0.16em] text-gradient-gold"
                style={{ textShadow: "0 0 24px oklch(0.78 0.13 85 / 0.35)" }}
              >
                VALERION
                <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 text-gradient-gold blur-[6px]">
                  VALERION
                </span>
              </motion.div>
            </div>
          </Link>

          {/* RIGHT — NAV + ICONS */}
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex items-center gap-9">
              {links.map((l) => (
                <div
                  key={l.to}
                  className="relative"
                  onMouseEnter={() => l.mega && setHoverMega(l.mega)}
                >
                  <Link
                    to={l.to}
                    className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
                    activeProps={{ className: "text-gold" }}
                  >
                    <span className="relative">
                      {l.label}
                      <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
                    </span>
                    {l.mega && <ChevronDown className="h-3 w-3 opacity-60" />}
                  </Link>
                </div>
              ))}
            </nav>

            <div className="hidden md:block h-6 w-px bg-frost/20" />

            <div className="flex items-center gap-5 text-frost">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="hover:text-gold hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all"
              >
                <Search className="h-[18px] w-[18px]" />
              </button>
              <Link to="/wishlist" aria-label="Wishlist" className="relative hover:text-gold hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all">
                <Heart className="h-[18px] w-[18px]" />
                {wishCount > 0 && (
                  <motion.span
                    key={wishCount}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-gradient-gold text-[9px] font-semibold flex items-center justify-center text-midnight shadow-glow"
                  >
                    {wishCount}
                  </motion.span>
                )}
              </Link>
              <ProfileMenu onDark={onDark} />
              <Link to="/cart" aria-label="Cart" className="relative hover:text-gold hover:drop-shadow-[0_0_8px_rgba(212,175,55,0.6)] transition-all">
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-gradient-gold text-[9px] font-semibold flex items-center justify-center text-midnight shadow-glow"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </Link>
              <button
                onClick={() => setMenuOpen(true)}
                className="lg:hidden hover:text-gold transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

        {/* MEGA MENUS */}
        <AnimatePresence>
          {hoverMega === "shop" && (
            <MegaPanel onClose={() => setHoverMega(null)}>
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 max-w-md">
                {shopMenu.map((m, i) => (
                  <motion.div
                    key={m.label}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={m.to}
                      onClick={() => setHoverMega(null)}
                      className="group block text-[12px] tracking-[0.22em] uppercase text-frost/80 hover:text-gold py-1.5 transition-colors"
                    >
                      <span className="inline-block group-hover:translate-x-1 transition-transform duration-500">{m.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </MegaPanel>
          )}

          {hoverMega === "collection" && (
            <MegaPanel onClose={() => setHoverMega(null)}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {collections.slice(0, 6).map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.id }}
                      onClick={() => setHoverMega(null)}
                      className="group block"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden border border-gold/15 group-hover:border-gold/50 transition-colors">
                        <img
                          src={c.image}
                          alt={c.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/30 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="text-[9px] tracking-[0.3em] uppercase text-gold/80">{c.count} pieces</div>
                          <div className="font-display text-sm text-frost group-hover:text-gold transition-colors mt-0.5">{c.title}</div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </MegaPanel>
          )}
        </AnimatePresence>
      </motion.header>

      <AnimatePresence>{searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} links={links.map(({to,label})=>({to,label}))} />}</AnimatePresence>
    </>
  );
}

function MegaPanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onMouseLeave={onClose}
      className="absolute left-0 right-0 top-full"
      style={{
        background: "linear-gradient(180deg, oklch(0.10 0.05 258 / 0.96) 0%, oklch(0.08 0.05 258 / 0.96) 100%)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        borderBottom: "1px solid oklch(0.78 0.13 85 / 0.25)",
        boxShadow: "0 30px 60px -20px oklch(0 0 0 / 0.5)",
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12 py-10">
        {children}
      </div>
    </motion.div>
  );
}
