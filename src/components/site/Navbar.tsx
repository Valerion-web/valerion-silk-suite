import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, Menu } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { MobileMenu } from "./MobileMenu";
import { ProfileMenu } from "./ProfileMenu";
import BrandLogo from "@/components/common/BrandLogo";
import { useShop } from "@/lib/store";

const links = [
  { to: "/shop", label: "Shop", mega: "shop" as const },
  { to: "/collection", label: "Collection" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
  { to: "/track-order", label: "Track Order" },
];

const shopMenu: { label: string; slug?: string; to?: "/shop" }[] = [
  { label: "New Arrivals", to: "/shop" },
  { label: "Best Sellers", to: "/shop" },
  { label: "Premium Shirts", slug: "premium-shirts" },
  { label: "Ethnic Wear", slug: "ethnic-wear" },
  { label: "Formal Wear", slug: "modern-formalwear" },
  { label: "Accessories", slug: "accessories" },
];

export function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverMega, setHoverMega] = useState<"shop" | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = useLocation({ select: (s) => s.location.pathname });
  const { cartCount, wishCount } = useShop();

  useEffect(() => {
    setSearchOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className={`navbar ${scrolled ? "navbar-scrolled" : ""}`} onMouseLeave={() => setHoverMega(null)} key={pathname}>
        <div className="navbar-inner">
          {/* LEFT — SHOP & COLLECTION */}
          <div className="nav-left">
            <Link
              to="/shop"
              className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
            >
              <span className="relative">
                SHOP
                <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
              </span>
            </Link>
            <Link
              to="/category"
              className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
            >
              <span className="relative">
                COLLECTION
                <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
              </span>
            </Link>
          </div>

          {/* CENTER — Brand Logo */}
          <div className="nav-center">
            <BrandLogo />
          </div>

          {/* RIGHT — ABOUT, CONTACT, TRACK ORDER, Icons */}
          <div className="nav-right">
            <nav className="nav-links">
              <Link
                to="/about"
                className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
              >
                <span className="relative">
                  ABOUT
                  <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
                </span>
              </Link>
              <Link
                to="/contact"
                className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
              >
                <span className="relative">
                  CONTACT
                  <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
                </span>
              </Link>
              <Link
                to="/track-order"
                className="group relative text-[11px] uppercase tracking-luxury font-medium text-frost/85 hover:text-gold transition-all duration-500 flex items-center gap-1"
              >
                <span className="relative">
                  TRACK ORDER
                  <span className="pointer-events-none absolute -bottom-2 left-0 h-px w-full origin-right scale-x-0 bg-gradient-to-r from-transparent via-gold to-transparent transition-transform duration-700 ease-out group-hover:origin-left group-hover:scale-x-100" />
                </span>
              </Link>
            </nav>

            <div className="nav-divider" />

            <div className="nav-icons">
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setMenuOpen(false);
                }}
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
              <ProfileMenu onDark={true} />
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
                onClick={() => {
                  setMenuOpen(true);
                  setSearchOpen(false);
                }}
                className="lg:hidden hover:text-gold transition-colors"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* MEGA MENUS */}
        <AnimatePresence>
          {hoverMega === "shop" && (
            <MegaPanel onClose={() => setHoverMega(null)}>
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 max-w-md">
                {shopMenu.map((m, i) => {
                  const cls = "group block text-[12px] tracking-[0.22em] uppercase text-frost/80 hover:text-gold py-1.5 transition-colors";
                  const inner = <span className="inline-block group-hover:translate-x-1 transition-transform duration-500">{m.label}</span>;
                  return (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      {m.slug ? (
                        <Link to={`/collection/${m.slug}`} onClick={() => setHoverMega(null)} className={cls}>{inner}</Link>
                      ) : (
                        <Link to={m.to!} onClick={() => setHoverMega(null)} className={cls}>{inner}</Link>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </MegaPanel>
          )}
        </AnimatePresence>
      </header>

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

export default Navbar;
