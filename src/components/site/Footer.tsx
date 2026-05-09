import { Link } from "@tanstack/react-router";
import { Instagram, Twitter, Facebook, Youtube } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gradient-navy text-frost relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gold opacity-50 pointer-events-none" />
      <div className="relative mx-auto max-w-[1500px] px-6 lg:px-12 py-20">
        <div className="grid gap-14 md:grid-cols-4">
          <div>
            <div className="font-display text-2xl tracking-[0.14em]">VALERION</div>
            <div className="text-[9px] tracking-wider-luxury text-gold mt-1">HOUSE OF</div>
            <p className="mt-6 text-frost/60 text-sm leading-relaxed font-serif italic">
              Luxury tailored for elite modern gentlemen.
            </p>
            <div className="mt-8 flex gap-4 text-frost/70">
              {[Instagram, Twitter, Facebook, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="hover:text-gold transition-colors"><Icon className="h-4 w-4" /></a>
              ))}
            </div>
          </div>

          {[
            { title: "Maison", items: [["About", "/about"], ["Atelier", "/about"], ["Craftsmanship", "/about"], ["Sustainability", "/about"]] },
            { title: "Collections", items: [["Tailored Suits", "/shop"], ["Premium Shirts", "/shop"], ["Knitwear", "/shop"], ["Street Luxury", "/shop"]] },
            { title: "Client Care", items: [["Contact", "/contact"], ["Wishlist", "/wishlist"], ["Cart", "/cart"], ["Shipping", "/contact"]] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="text-[11px] tracking-luxury uppercase text-gold mb-6">{col.title}</h4>
              <ul className="space-y-3">
                {col.items.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-frost/70 text-sm link-underline hover:text-frost">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-frost/10 flex flex-col md:flex-row justify-between gap-4 text-[10px] tracking-luxury uppercase text-frost/50">
          <span>© {new Date().getFullYear()} House of Valerion · All rights reserved</span>
          <span>Crafted in Milano · Worn worldwide</span>
        </div>
      </div>
    </footer>
  );
}
