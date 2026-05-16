import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, Menu } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { MobileMenu } from "./MobileMenu";
import { useShop } from "@/lib/store";

const links = [
  { to: "/shop", label: "Collection" },
  { to: "/category", label: "Category" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Track Order" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";
  const { cartCount, wishCount } = useShop();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onDark = isHome && !scrolled;

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ${
          scrolled
            ? "glass-light shadow-card border-b border-gold/30"
            : isHome
              ? "bg-transparent border-b border-gold/10"
              : "bg-background/70 backdrop-blur-md border-b border-gold/15"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-[1600px] items-center justify-between px-6 lg:px-12">
          {/* LEFT — LOGO */}
          <Link to="/" className="group flex items-center shrink-0">
            <div className="leading-none">
              <div className={`text-[8px] md:text-[9px] tracking-wider-luxury mb-1 transition-colors ${onDark ? "text-gold/80" : "text-gold"}`}>
                HOUSE OF
              </div>
              <motion.div
                whileHover={{ letterSpacing: "0.22em" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative font-display text-2xl md:text-[28px] tracking-[0.16em] text-gradient-gold"
                style={{
                  textShadow: "0 0 24px oklch(0.78 0.13 85 / 0.35), 0 1px 0 oklch(1 0 0 / 0.05)",
                }}
              >
                VALERION
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 text-gradient-gold blur-[6px]"
                >
                  VALERION
                </span>
              </motion.div>
            </div>
          </Link>

          {/* RIGHT — NAV + ICONS */}
          <div className="flex items-center gap-8">
            <nav className="hidden lg:flex items-center gap-9">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`group relative text-[11px] uppercase tracking-luxury font-medium transition-all duration-500 hover:tracking-[0.4em] ${
                    onDark ? "text-frost/85 hover:text-gold" : "text-foreground hover:text-gold"
                  }`}
                  activeProps={{ className: "text-gold" }}
                >
                  <span className="relative">
                    {l.label}
                    <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
                  </span>
                </Link>
              ))}
            </nav>

            <div className={`hidden md:block h-6 w-px ${onDark ? "bg-frost/20" : "bg-border"}`} />

            <div className={`flex items-center gap-5 ${onDark ? "text-frost" : "text-foreground"}`}>
              <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hover:text-gold transition-colors">
                <Search className="h-[18px] w-[18px]" />
              </button>
              <Link to="/wishlist" aria-label="Wishlist" className="relative hover:text-gold transition-colors">
                <Heart className="h-[18px] w-[18px]" />
                {wishCount > 0 && (
                  <motion.span
                    key={wishCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-gradient-gold text-[9px] font-semibold flex items-center justify-center text-midnight shadow-glow"
                  >
                    {wishCount}
                  </motion.span>
                )}
              </Link>
              <Link to="/cart" aria-label="Cart" className="relative hover:text-gold transition-colors">
                <ShoppingBag className="h-[18px] w-[18px]" />
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
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

        {/* Hairline gold sheen */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </motion.header>

      <AnimatePresence>{searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} links={links} />}</AnimatePresence>
    </>
  );
}
