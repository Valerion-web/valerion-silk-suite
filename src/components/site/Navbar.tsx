import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Heart, ShoppingBag, Menu, X } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { MobileMenu } from "./MobileMenu";

const links = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "Atelier" },
  { to: "/contact", label: "Contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

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
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ${
          scrolled
            ? "glass-light shadow-card"
            : isHome
              ? "bg-transparent"
              : "bg-background/80 backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-[1500px] items-center justify-between px-6 lg:px-12">
          <button
            onClick={() => setMenuOpen(true)}
            className={`lg:hidden ${onDark ? "text-frost" : "text-foreground"}`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav className="hidden lg:flex items-center gap-10">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`link-underline text-[11px] uppercase tracking-luxury font-medium transition-colors ${
                  onDark ? "text-frost/90 hover:text-gold" : "text-foreground hover:text-gold"
                }`}
                activeProps={{ className: "text-gold" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <motion.div whileHover={{ letterSpacing: "0.18em" }} transition={{ duration: 0.6 }}>
              <div className={`font-display text-xl md:text-2xl tracking-[0.14em] ${onDark ? "text-frost" : "text-foreground"}`}>
                VALERION
              </div>
              <div className={`text-center text-[8px] tracking-wider-luxury mt-0.5 ${onDark ? "text-gold/80" : "text-gold"}`}>
                HOUSE OF
              </div>
            </motion.div>
          </Link>

          <div className={`flex items-center gap-5 ${onDark ? "text-frost" : "text-foreground"}`}>
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="hover:text-gold transition-colors">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <Link to="/wishlist" aria-label="Wishlist" className="hover:text-gold transition-colors">
              <Heart className="h-[18px] w-[18px]" />
            </Link>
            <Link to="/cart" aria-label="Cart" className="relative hover:text-gold transition-colors">
              <ShoppingBag className="h-[18px] w-[18px]" />
              <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-gold text-[9px] font-semibold flex items-center justify-center text-midnight">2</span>
            </Link>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>{searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} links={links} />}</AnimatePresence>
    </>
  );
}
