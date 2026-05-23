import { Link } from "react-router-dom";
import { Instagram, Twitter, Facebook, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative overflow-hidden footer-navy text-[#f8f8fa] border-t">
      <div className="absolute inset-0 bg-radial-gold opacity-10 pointer-events-none" />
      <div className="pointer-events-none absolute -top-px inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="relative mx-auto max-w-[1500px] px-6 lg:px-12 py-24">
        <div className="grid gap-14 md:grid-cols-4">
          <div>
            <div className="text-[9px] tracking-wider-luxury text-gold/90 mb-2">HOUSE OF</div>
            <div
              className="relative font-display text-3xl md:text-[34px] tracking-[0.18em] text-white inline-block"
              style={{
                textShadow:
                  "0 0 18px rgba(212,175,55,0.18), 0 0 40px rgba(212,175,55,0.12)",
              }}
            >
              VALERION
              <span className="pointer-events-none absolute inset-0 overflow-hidden">
                <span
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-frost/40 to-transparent skew-x-[-20deg] animate-[shimmer_3.5s_ease-in-out_infinite]"
                />
              </span>
            </div>
            <p className="mt-7 text-[#F5F1E8]/80 text-sm leading-relaxed font-serif italic">
              Luxury tailored for the modern gentleman. Crafted with intention, worn with quiet confidence.
            </p>
            <div className="mt-8 flex gap-4 text-[#F5F1E8]/70">
              {[Instagram, Twitter, Facebook, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="h-9 w-9 grid place-items-center border border-frost/15 hover:border-gold hover:text-gold transition-all duration-500"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: "Maison", items: [["About", "/about"], ["Atelier", "/about"], ["Craftsmanship", "/about"], ["Categories", "/category"]] },
            { title: "Collections", items: [["Shop All", "/shop"], ["Tailored Suits", "/category/tailored-suits"], ["Premium Shirts", "/category/premium-shirts"], ["Knitwear", "/category/knitwear-essentials"]] },
            { title: "Client Care", items: [["Contact", "/contact"], ["Wishlist", "/wishlist"], ["Cart", "/cart"], ["Track Order", "/track-order"]] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] tracking-luxury uppercase text-gold mb-6">{col.title}</h4>
              <ul className="space-y-3">
                {col.items.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-[#F5F1E8]/80 text-sm link-underline hover:text-white">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 pt-8 border-t border-[#2a3050] flex flex-col md:flex-row justify-between gap-4 text-[10px] tracking-luxury uppercase text-[#F5F1E8]/70">
          <span>© {new Date().getFullYear()} House of Valerion · All rights reserved</span>
          <span>Crafted in Milano · Worn worldwide</span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(0) skewX(-20deg); }
          60%, 100% { transform: translateX(450%) skewX(-20deg); }
        }
      `}</style>
    </footer>
  );
}

export default Footer;
