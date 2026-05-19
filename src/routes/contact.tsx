;
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, MapPin, MessageCircle, Instagram, Twitter, CheckCircle2, Clock } from "lucide-react";
import { PageShell, PageHeader } from "@/components/site/PageShell";



function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <>
      <PageHeader eyebrow="Get in Touch" title="Speak with the House" subtitle="Private appointments, bespoke commissions, and client care." />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1300px] px-6 lg:px-12 mt-16 grid lg:grid-cols-2 gap-12">
          <div className="glass-light p-8 md:p-12 shadow-card">
            <h2 className="font-display text-3xl">Send a Letter</h2>
            <p className="mt-2 font-serif italic text-muted-foreground">A member of the House will reply within 24 hours.</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Your name" />
              <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@email.com" />
              <Field label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="What may we assist with?" />
              <div>
                <label className="text-[10px] tracking-luxury uppercase text-muted-foreground">Message</label>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Your message"
                  className="mt-2 w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-gold resize-none transition-colors"
                />
              </div>
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-midnight text-frost py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500"
              >
                Send Message
              </motion.button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-navy text-frost p-8 md:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-radial-gold opacity-40" />
              <div className="relative">
                <h3 className="font-display text-2xl">Atelier Bangalore</h3>
                <p className="mt-1 font-serif italic text-frost/70">By private appointment only</p>

                <div className="mt-8 space-y-5 text-sm">
                  <Info Icon={MapPin} primary="Whitefield, Bangalore – 560066" secondary="Karnataka, India" />
                  <Info Icon={Phone} primary="+91 80 4567 8900" secondary="Mon–Sat · 10:00–19:00 IST" />
                  <Info Icon={Mail} primary="atelier@valerion.com" secondary="For private commissions" />
                  <Info Icon={Clock} primary="Business Hours" secondary="Monday – Saturday · 10:00 – 19:00 IST" />
                </div>

                <a href="https://wa.me/918045678900" target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-3 bg-gold text-midnight px-6 py-3 text-[11px] tracking-luxury uppercase hover:bg-frost transition-colors">
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
                title="Whitefield, Bangalore"
                className="absolute inset-0 h-full w-full grayscale contrast-125"
                src="https://www.openstreetmap.org/export/embed.html?bbox=77.72%2C12.96%2C77.78%2C13.00&layer=mapnik&marker=12.98,77.75"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </PageShell>

      {/* Success modal */}
      <AnimatePresence>
        {sent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-midnight/80 backdrop-blur-md p-6"
            onClick={() => setSent(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full bg-background border border-gold/40 shadow-[0_0_60px_rgba(212,175,55,0.45)] p-10 text-center"
            >
              <div className="absolute inset-0 bg-radial-gold opacity-30 pointer-events-none" />
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 18 }}
                className="relative mx-auto h-20 w-20 rounded-full bg-gradient-gold grid place-items-center shadow-glow"
              >
                <CheckCircle2 className="h-10 w-10 text-midnight" />
              </motion.div>
              <p className="relative mt-6 text-[10px] tracking-wider-luxury text-gold">— Letter Received —</p>
              <h3 className="relative mt-4 font-display text-3xl text-gradient-gold">Message Sent Successfully</h3>
              <p className="relative mt-4 font-serif italic text-muted-foreground">
                A member of the House will be in touch within 24 hours. Thank you for writing to House of Valerion.
              </p>
              <button
                onClick={() => setSent(false)}
                className="relative mt-8 inline-block bg-midnight text-frost px-8 py-3 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Field({ label, type = "text", placeholder, value, onChange }: { label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] tracking-luxury uppercase text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full bg-transparent border border-border px-4 py-3 text-sm outline-none focus:border-gold transition-colors"
      />
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

export default ContactPage;
