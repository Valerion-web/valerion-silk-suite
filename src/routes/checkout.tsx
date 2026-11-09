import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  CreditCard,
  Smartphone,
  Wallet,
  Banknote,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { findProduct } from "@/lib/products";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/site/PageShell";
import { useShop } from "@/lib/store";

const PAYMENT_METHODS = [
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, available: false },
  { id: "upi", label: "UPI", icon: Smartphone, available: false },
  { id: "gpay", label: "Google Pay", icon: Wallet, available: false },
  { id: "phonepe", label: "PhonePe", icon: Wallet, available: false },
  { id: "paytm", label: "Paytm", icon: Wallet, available: false },
  { id: "netbanking", label: "Net Banking", icon: Banknote, available: false },
  { id: "cod", label: "Cash on Delivery", icon: Banknote, available: true },
];

const DEFINITE_COD_CONFLICTS = new Set([
  "A selected product is unavailable",
  "A selected product option is unavailable",
  "This product option is not configured for ordering",
  "A selected product is not ready for shipment",
  "A selected product quantity is unavailable",
  "This checkout key is already associated with another payment",
  "This checkout key is already associated with a different payment request",
  "This checkout key is already associated with another order",
  "Stock changed while ordering",
  "Coupon usage limit was reached before order finalization",
  "Coupon user usage limit was reached before order finalization",
]);

const isDefiniteCodConflict = (message: unknown) =>
  typeof message === "string" &&
  (DEFINITE_COD_CONFLICTS.has(message) || message.startsWith("Insufficient stock for "));

type CodEligibility = {
  eligible: boolean;
  reason: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: "INR";
  items: Array<{
    slug: string;
    name: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

type CheckoutAddress = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type CodRequest = {
  idempotencyKey: string;
  items: Array<{ slug: string; size: string; color: string; quantity: number }>;
  shippingAddress: CheckoutAddress;
  billingAddress: CheckoutAddress;
};

const formatRupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const fingerprintRequest = async (request: Omit<CodRequest, "idempotencyKey">) => {
  const bytes = new TextEncoder().encode(JSON.stringify(request));
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

function CheckoutPage() {
  const { cart, clearCart } = useShop();
  const { user, hydrated: authHydrated } = useAuth();
  const navigate = useNavigate();

  const lines = cart
    .map((c) => ({ ...c, product: findProduct(c.id) }))
    .filter((l) => l.product) as Array<{
    id: string;
    qty: number;
    size: string;
    color: string;
    product: NonNullable<ReturnType<typeof findProduct>>;
  }>;

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const shipping = subtotal > 0 ? 0 : 0;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shipping + tax;

  const [ship, setShip] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    apartment: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [pay, setPay] = useState("cod");
  const [placed, setPlaced] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<number | null>(null);
  const [codEligibility, setCodEligibility] = useState<CodEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const submittingRef = useRef(false);
  const pendingRequestRef = useRef<CodRequest | null>(null);

  const checkoutItems = lines.map((line) => ({
    slug: line.id,
    size: line.size,
    color: line.color,
    quantity: line.qty,
  }));
  const checkoutItemsFingerprint = JSON.stringify(checkoutItems);

  useEffect(() => {
    if (pay !== "cod") {
      setCodEligibility(null);
      setEligibilityLoading(false);
      return;
    }
    if (checkoutItemsFingerprint === "[]") {
      setCodEligibility(null);
      setEligibilityLoading(false);
      return;
    }
    if (!authHydrated || !user) {
      setCodEligibility(null);
      setEligibilityLoading(false);
      return;
    }
    const controller = new AbortController();
    setEligibilityLoading(true);
    setCodEligibility(null);
    setCheckoutError(null);

    const loadEligibility = async () => {
      try {
        const response = await apiFetch("/api/checkout/cod/eligibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: JSON.parse(checkoutItemsFingerprint) }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            response.status >= 500
              ? "COD eligibility could not be checked. Please try again."
              : typeof data.message === "string"
                ? data.message
                : "COD eligibility could not be checked.",
          );
        }
        setCodEligibility(data as CodEligibility);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setCheckoutError(
          error instanceof Error ? error.message : "COD eligibility could not be checked.",
        );
      } finally {
        if (!controller.signal.aborted) setEligibilityLoading(false);
      }
    };

    void loadEligibility();
    return () => controller.abort();
  }, [authHydrated, checkoutItemsFingerprint, pay, user]);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || placed) return;
    if (pay !== "cod") {
      setCheckoutError(
        "Online payment is not available in this checkout. Select Cash on Delivery to continue.",
      );
      return;
    }
    if (!authHydrated || !user) {
      setCheckoutError("Sign in to place a COD order.");
      return;
    }
    if (!codEligibility?.eligible) {
      setCheckoutError(
        codEligibility?.reason ?? "Check COD eligibility before placing your order.",
      );
      return;
    }

    const currentRequest: Omit<CodRequest, "idempotencyKey"> = {
      items: checkoutItems,
      shippingAddress: {
        name: ship.name.trim(),
        phone: ship.mobile.trim(),
        email: ship.email.trim(),
        line1: ship.address.trim(),
        line2: ship.apartment.trim() || null,
        city: ship.city.trim(),
        state: ship.state.trim(),
        postalCode: ship.pincode.trim(),
        country: ship.country.trim(),
      },
      billingAddress: {
        name: ship.name.trim(),
        phone: ship.mobile.trim(),
        email: ship.email.trim(),
        line1: ship.address.trim(),
        line2: ship.apartment.trim() || null,
        city: ship.city.trim(),
        state: ship.state.trim(),
        postalCode: ship.pincode.trim(),
        country: ship.country.trim(),
      },
    };
    submittingRef.current = true;
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const requestFingerprint = await fingerprintRequest(currentRequest);
      const storageKey = `haston.cod.pending.${user.id}`;
      const storedValue = window.sessionStorage.getItem(storageKey);
      const storedAttempt = storedValue
        ? (JSON.parse(storedValue) as { fingerprint?: string; idempotencyKey?: string })
        : null;
      if (
        storedAttempt &&
        (storedAttempt.fingerprint !== requestFingerprint ||
          typeof storedAttempt.idempotencyKey !== "string" ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(storedAttempt.idempotencyKey))
      ) {
        throw new Error(
          "A previous COD request is awaiting confirmation. Restore its original details and retry before starting another checkout.",
        );
      }
      const request: CodRequest = pendingRequestRef.current ?? {
        ...currentRequest,
        idempotencyKey: storedAttempt?.idempotencyKey ?? window.crypto.randomUUID(),
      };
      if (!pendingRequestRef.current && !storedAttempt) {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            fingerprint: requestFingerprint,
            idempotencyKey: request.idempotencyKey,
          }),
        );
      }
      const response = await apiFetch("/api/checkout/cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }).catch(() => {
        pendingRequestRef.current = request;
        setSubmissionUncertain(true);
        throw new Error(
          "We couldn't confirm whether the order was saved. Retry to safely check the same request.",
        );
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data.message === "string" ? data.message : null;
        const definiteFailure =
          [400, 401, 403, 404].includes(response.status) ||
          (response.status === 409 && isDefiniteCodConflict(message));
        if (definiteFailure) {
          window.sessionStorage.removeItem(storageKey);
          pendingRequestRef.current = null;
          setSubmissionUncertain(false);
          throw new Error(
            response.status === 409
              ? `Checkout conflict: ${message}. This request was rejected; review your cart and delivery details, then submit again.`
              : `${message ?? "Checkout details were rejected."} Correct the details and submit again.`,
          );
        }
        if (response.status === 408 || response.status >= 500 || response.status === 409) {
          pendingRequestRef.current = request;
          setSubmissionUncertain(true);
          throw new Error(
            message ??
              "We couldn't confirm whether the order was saved. Retry to safely check the same request.",
          );
        }
        throw new Error(message ?? "Unable to place the COD order.");
      }
      if (
        data.success !== true ||
        !Number.isSafeInteger(data.orderId) ||
        data.paymentStatus !== "PENDING_COLLECTION"
      ) {
        pendingRequestRef.current = request;
        setSubmissionUncertain(true);
        throw new Error(
          "The server response was incomplete. Retry to safely check the same order request.",
        );
      }
      pendingRequestRef.current = null;
      window.sessionStorage.removeItem(storageKey);
      setSubmissionUncertain(false);
      setPlacedOrderId(data.orderId);
      setPlaced(true);
      clearCart();
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to place the COD order.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (lines.length === 0 && !placed) {
    return (
      <>
        <PageHeader eyebrow="Secure Checkout" title="Checkout" />
        <PageShell className="pt-0">
          <div className="text-center py-32">
            <h2 className="font-display text-3xl">Your bag is empty</h2>
            <Link
              to="/shop"
              className="mt-8 inline-block bg-midnight text-frost px-9 py-4 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Secure Checkout"
        title="Checkout"
        subtitle="Your contact and delivery details are used to place your order."
      />
      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-12 mt-10">
          <nav className="mb-10 flex items-center gap-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
            <Link to="/cart" className="hover:text-gold">
              Cart
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gold">Checkout</span>
            <ChevronRight className="h-3 w-3" />
            <span>Confirmation</span>
          </nav>

          <form onSubmit={placeOrder} className="grid lg:grid-cols-[1fr_420px] gap-12">
            <div className="space-y-10">
              {/* SHIPPING */}
              <Section number="01" title="Shipping Details">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Floating
                    disabled={submissionUncertain}
                    label="Full Name"
                    value={ship.name}
                    onChange={(v) => setShip({ ...ship, name: v })}
                    required
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Mobile Number"
                    value={ship.mobile}
                    onChange={(v) => setShip({ ...ship, mobile: v })}
                    type="tel"
                    required
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Email Address"
                    value={ship.email}
                    onChange={(v) => setShip({ ...ship, email: v })}
                    type="email"
                    required
                    className="sm:col-span-2"
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Street Address"
                    value={ship.address}
                    onChange={(v) => setShip({ ...ship, address: v })}
                    required
                    className="sm:col-span-2"
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Apartment / Landmark"
                    value={ship.apartment}
                    onChange={(v) => setShip({ ...ship, apartment: v })}
                    className="sm:col-span-2"
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="City"
                    value={ship.city}
                    onChange={(v) => setShip({ ...ship, city: v })}
                    required
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="State"
                    value={ship.state}
                    onChange={(v) => setShip({ ...ship, state: v })}
                    required
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Pincode"
                    value={ship.pincode}
                    onChange={(v) => setShip({ ...ship, pincode: v })}
                    required
                  />
                  <Floating
                    disabled={submissionUncertain}
                    label="Country"
                    value={ship.country}
                    onChange={(v) => setShip({ ...ship, country: v })}
                    required
                  />
                </div>
              </Section>

              {/* PAYMENT */}
              <Section
                number="02"
                title="Payment Method"
                right={
                  <span className="inline-flex items-center gap-2 text-[10px] tracking-luxury uppercase text-gold">
                    <Lock className="h-3 w-3" /> Secure
                  </span>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = pay === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        disabled={!m.available || submissionUncertain || submitting}
                        onClick={() => {
                          setPay(m.id);
                          setCheckoutError(null);
                        }}
                        className={`flex items-center gap-3 px-4 py-4 border text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-gold bg-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.2)]" : "border-border hover:border-gold/60"}`}
                      >
                        <Icon
                          className={`h-5 w-5 ${active ? "text-gold" : "text-muted-foreground"}`}
                        />
                        <span className="text-[11px] tracking-luxury uppercase">
                          {m.available ? m.label : `${m.label} — Unavailable`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  {pay !== "cod" && (
                    <motion.p
                      key="online"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-6 font-serif italic text-muted-foreground"
                    >
                      Online payment is not connected to this checkout. Payment credentials are not
                      collected; choose Cash on Delivery to place an order.
                    </motion.p>
                  )}
                  {pay === "cod" && (
                    <motion.div
                      key="cod"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`mt-6 font-serif italic ${codEligibility && !codEligibility.eligible ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {!authHydrated
                        ? "Checking your sign-in status..."
                        : !user
                          ? "Sign in from your account menu to check COD eligibility and place this order."
                          : eligibilityLoading
                            ? "Checking your cart and COD eligibility using current store prices..."
                            : codEligibility
                              ? codEligibility.eligible
                                ? `COD is available. Server-confirmed total: ${formatRupees(codEligibility.total)}.`
                                : codEligibility.reason
                              : "COD eligibility could not be confirmed. Please refresh and try again."}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Section>

              {checkoutError && (
                <p
                  role="alert"
                  className="border border-destructive/50 bg-destructive/5 px-5 py-4 text-sm text-destructive"
                >
                  {checkoutError}
                </p>
              )}

              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={
                  submitting ||
                  placed ||
                  pay !== "cod" ||
                  (pay === "cod" && (!user || eligibilityLoading || !codEligibility?.eligible))
                }
                className="w-full bg-midnight text-frost py-5 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500 inline-flex items-center justify-center gap-3"
              >
                <Lock className="h-4 w-4" />
                {submitting
                  ? "Submitting Order..."
                  : submissionUncertain
                    ? "Retry Order Confirmation"
                    : pay === "cod"
                      ? codEligibility?.eligible
                        ? `Place COD Order · ${formatRupees(codEligibility.total)}`
                        : "COD unavailable"
                      : "Online payment unavailable"}
              </motion.button>
            </div>

            {/* ORDER SUMMARY */}
            <aside className="lg:sticky lg:top-28 self-start">
              <div className="glass-light p-8 border border-gold/20">
                <h3 className="font-display text-2xl">Order Summary</h3>
                <div className="mt-6 space-y-5 max-h-[360px] overflow-y-auto pr-2">
                  {lines.map((l, index) => (
                    <div key={`${l.id}-${l.size}-${l.color}`} className="flex gap-4">
                      <div className="w-20 aspect-[3/4] shrink-0 overflow-hidden bg-muted relative">
                        <img
                          src={l.product.image}
                          alt={l.product.name}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 grid place-items-center rounded-full bg-gold text-midnight text-[10px] font-semibold">
                          {l.qty}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] tracking-luxury uppercase text-muted-foreground">
                          {l.product.category}
                        </p>
                        <h4 className="font-display text-sm mt-1 leading-tight">
                          {l.product.name}
                        </h4>
                        <p className="text-[10px] tracking-luxury uppercase text-muted-foreground mt-1">
                          Size {l.size}
                        </p>
                      </div>
                      <p className="font-serif text-sm shrink-0">
                        {pay === "cod"
                          ? codEligibility?.items[index]
                            ? formatRupees(codEligibility.items[index].lineTotal)
                            : "Checking..."
                          : formatRupees(l.product.price * l.qty)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-border space-y-3 text-sm">
                  {pay === "cod" ? (
                    <>
                      {codEligibility ? (
                        <>
                          <Row label="Subtotal" value={formatRupees(codEligibility.subtotal)} />
                          {codEligibility.discount > 0 && (
                            <Row
                              label="Discount"
                              value={`-${formatRupees(codEligibility.discount)}`}
                            />
                          )}
                          <Row
                            label="Shipping"
                            value={
                              codEligibility.shipping > 0
                                ? formatRupees(codEligibility.shipping)
                                : "Complimentary"
                            }
                          />
                        </>
                      ) : (
                        <Row label="Server pricing" value="Checking..." />
                      )}
                    </>
                  ) : (
                    <>
                      <Row label="Subtotal" value={formatRupees(subtotal)} />
                      <Row label="Shipping" value="Complimentary" />
                      <Row label="Tax (est.)" value={formatRupees(tax)} />
                    </>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gold/30 flex justify-between items-baseline">
                  <span className="text-[11px] tracking-luxury uppercase">Total</span>
                  <span className="font-display text-3xl text-gradient-gold">
                    {pay === "cod"
                      ? codEligibility
                        ? formatRupees(codEligibility.total)
                        : "Checking..."
                      : formatRupees(total)}
                  </span>
                </div>

                <div className="mt-6 pt-6 border-t border-border space-y-2 text-[10px] tracking-luxury uppercase text-muted-foreground">
                  <p className="inline-flex items-center gap-2">
                    <Lock className="h-3 w-3 text-gold" /> 256-bit Encrypted Payment
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-gold" /> Complimentary Insured Delivery
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-gold" /> 30-Day Returns
                  </p>
                </div>
              </div>
            </aside>
          </form>
        </div>
      </PageShell>

      <AnimatePresence>
        {placed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-midnight/85 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
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
              <p className="relative mt-6 text-[10px] tracking-wider-luxury text-gold">
                — Order Confirmed —
              </p>
              <h3 className="relative mt-4 font-display text-3xl text-gradient-gold">Thank you</h3>
              <p className="relative mt-4 font-serif italic text-muted-foreground">
                Order {placedOrderId ? `#${placedOrderId} ` : ""}has been placed. Payment remains
                pending collection and is due in cash upon delivery.
              </p>
              <div className="relative mt-8 flex flex-col gap-3">
                <button
                  onClick={() => {
                    clearCart();
                    navigate("/track-order");
                  }}
                  className="bg-midnight text-frost px-8 py-3 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors"
                >
                  Track Your Order
                </button>
                <button
                  onClick={() => {
                    clearCart();
                    navigate("/shop");
                  }}
                  className="text-[11px] tracking-luxury uppercase text-muted-foreground hover:text-gold"
                >
                  Continue Shopping
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Section({
  number,
  title,
  right,
  children,
}: {
  number: string;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-light p-8 md:p-10 border border-border">
      <div className="flex items-center justify-between mb-6 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl text-gold">{number}</span>
          <h2 className="font-display text-2xl">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Floating({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? " "}
        required={required}
        disabled={disabled}
        className="peer w-full bg-transparent border border-border px-4 pt-6 pb-3 text-sm outline-none focus:border-gold transition-all duration-300 placeholder-transparent disabled:opacity-60"
      />
      <label className="pointer-events-none absolute left-4 top-2 text-[9px] tracking-luxury uppercase text-muted-foreground transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-xs peer-placeholder-shown:tracking-normal peer-placeholder-shown:normal-case peer-focus:top-2 peer-focus:text-[9px] peer-focus:tracking-luxury peer-focus:uppercase peer-focus:text-gold">
        {label}
      </label>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export default CheckoutPage;
