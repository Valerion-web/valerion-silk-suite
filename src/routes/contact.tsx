import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, MapPin, MessageCircle, Instagram, Twitter } from "lucide-react";
import { PageShell, PageHeader } from "@/components/site/PageShell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — House of Valerion" },
      { name: "description", content: "Speak with the House of Valerion atelier. Private appointments, custom commissions, client care." },
      { property: "og:title", content: "Contact — House of Valerion" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <>
      <PageHeader eyebrow="Get in Touch" title="Speak with the House" subtitle="Private appointments, bespoke commissions, and client care." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-16 grid lg:grid-cols-2 gap-12">
          <div className="glass-light p-8 md:p-12 shadow-card">
            <h2 className="font-display text-3xl">Send a Letter</h2>
            <p className="mt-2 font-serif italic text-muted-foreground">A member of the House will reply within 24 hours.</p>

            <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-5">
              <Field label="Full Name" placeholder="Your name" />
              <Field label="Email" type="email" placeholder="you@email.com" />
              <Field label="Subject" placeholder="What may we assist with?" />
              <div>
                <label className="text-[10px] tracking-luxury uppercase text-muted-foreground">Message</label>
                <textarea rows={5} placeholder="Your message" className="mt-2 w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-gold resize-none" />
              </div>
              <button className="w-full bg-midnight text-frost py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500">
                Send Message
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-navy text-frost p-8 md:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-radial-gold opacity-40" />
              <div className="relative">
                <h3 className="font-display text-2xl">Atelier Milano</h3>
                <p className="mt-1 font-serif italic text-frost/70">By private appointment only</p>

                <div className="mt-8 space-y-5 text-sm">
                  <Info Icon={MapPin} primary="Via Montenapoleone 17" secondary="20121 Milano, Italia" />
                  <Info Icon={Phone} primary="+39 02 7634 0000" secondary="Mon–Sat · 10:00–19:00 CET" />
                  <Info Icon={Mail} primary="atelier@valerion.com" secondary="For private commissions" />
                </div>

                <a href="#" className="mt-8 inline-flex items-center gap-3 bg-gold text-midnight px-6 py-3 text-[11px] tracking-luxury uppercase hover:bg-frost transition-colors">
                  <MessageCircle className="h-4 w-4" /> WhatsApp Concierge
                </a>

                <div className="mt-8 pt-6 border-t border-frost/10 flex gap-4 text-frost/70">
                  <a href="#" className="hover:text-gold"><Instagram className="h-5 w-5" /></a>
                  <a href="#" className="hover:text-gold"><Twitter className="h-5 w-5" /></a>
                </div>
              </div>
            </div>

            <div className="aspect-video bg-muted relative overflow-hidden border border-border">
              <iframe
                title="Map"
                className="absolute inset-0 h-full w-full grayscale contrast-125"
                src="https://www.openstreetmap.org/export/embed.html?bbox=9.18%2C45.46%2C9.20%2C45.48&layer=mapnik"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function Field({ label, type = "text", placeholder }: { label: string; type?: string; placeholder: string }) {
  return (
    <div>
      <label className="text-[10px] tracking-luxury uppercase text-muted-foreground">{label}</label>
      <input type={type} placeholder={placeholder} className="mt-2 w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-gold" />
    </div>
  );
}

function Info({ Icon, primary, secondary }: { Icon: typeof Mail; primary: string; secondary: string }) {
  return (
    <div className="flex gap-4">
      <Icon className="h-5 w-5 text-gold shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">{primary}</p>
        <p className="text-frost/60 text-xs mt-0.5">{secondary}</p>
      </div>
    </div>
  );
}
