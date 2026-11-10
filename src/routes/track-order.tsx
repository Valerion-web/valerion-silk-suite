import { useState, type FormEvent } from "react";
import { CheckCircle2, Package, Search, Truck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { PageHeader, PageShell } from "@/components/site/PageShell";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type TrackingEvent = {
  id: number;
  status?: string | null;
  activity?: string | null;
  location?: string | null;
  occurredAt?: string | null;
};

type OrderTracking = {
  id: number;
  status?: string | null;
  createdAt?: string | null;
  currency?: string | null;
  shipment?: {
    awbCode?: string | null;
    courierName?: string | null;
    currentStatus?: string | null;
    currentStatusAt?: string | null;
    estimatedDeliveryAt?: string | null;
    events: TrackingEvent[];
  } | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function TrackOrderPage() {
  const { user, hydrated } = useAuth();
  const location = useLocation();
  const [orderReference, setOrderReference] = useState("");
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hydrated || !user) return;
    const orderId = orderReference.trim();
    if (!/^\d+$/.test(orderId) || Number(orderId) < 1) {
      setError("Enter the numeric order number from your order confirmation.");
      setTracking(null);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(false);
      const response = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to load tracking information.");
      }
      setTracking(data as OrderTracking);
      setSearched(true);
    } catch (requestError) {
      setTracking(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to load tracking information.");
    } finally {
      setLoading(false);
    }
  };

  const pageHeader = (
    <PageHeader
      eyebrow="Order updates"
      title="Track Your Order"
      subtitle="View shipment updates shared by the courier for your order."
    />
  );

  if (!hydrated) {
    return (
      <>
        {pageHeader}
        <PageShell className="pt-0">
          <div className="mx-auto mt-12 max-w-5xl px-6">
            <div
              role="status"
              className="rounded-[32px] border border-border bg-background p-8 text-sm text-muted-foreground"
            >
              Checking your sign-in status...
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  if (!user) {
    return (
      <>
        {pageHeader}
        <PageShell className="pt-0">
          <div className="mx-auto mt-12 max-w-5xl px-6">
            <section className="rounded-[32px] border border-border bg-background p-8 text-center shadow-card md:p-10">
              <h2 className="font-serif text-2xl text-foreground">Sign in to track your order</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Order tracking is available to signed-in customers. Sign in to view your shipment
                status and courier updates.
              </p>
              <Link
                to="/"
                state={{
                  openSignIn: true,
                  returnTo: `${location.pathname}${location.search}${location.hash}`,
                }}
                className="mt-6 inline-flex rounded-full bg-gold px-8 py-3 text-xs uppercase tracking-wider-luxury text-midnight transition hover:bg-[#E3B73B]"
              >
                Sign in
              </Link>
            </section>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      {pageHeader}
      <PageShell className="pt-0">
        <div className="mx-auto mt-12 max-w-5xl px-6">
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-border bg-background p-6 shadow-card md:p-8"
          >
            <label htmlFor="order-reference" className="text-[10px] uppercase tracking-wider-luxury text-gold">
              Order number
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[20px] border border-border px-4 py-3">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  id="order-reference"
                  inputMode="numeric"
                  autoComplete="off"
                  value={orderReference}
                  onChange={(inputEvent) => setOrderReference(inputEvent.target.value)}
                  placeholder="Enter your numeric order number"
                  className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-gold px-8 py-3 text-xs uppercase tracking-wider-luxury text-midnight transition hover:bg-[#E3B73B] disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Loading..." : "Track order"}
              </button>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
          </form>

          {loading && (
            <div role="status" className="mt-8 rounded-[28px] border border-border bg-background p-8 text-sm text-muted-foreground">
              Loading your order tracking...
            </div>
          )}

          {!loading && searched && tracking && (
            <section className="mt-8 space-y-6" aria-label="Order tracking details">
              <div className="rounded-[32px] border border-border bg-background p-6 shadow-card md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider-luxury text-gold">Order information</p>
                    <h2 className="mt-2 font-serif text-2xl text-foreground">Order #{tracking.id}</h2>
                    {tracking.createdAt && (
                      <p className="mt-2 text-sm text-muted-foreground">Placed {formatDate(tracking.createdAt) || "date unavailable"}</p>
                    )}
                  </div>
                  <span className="rounded-full border border-border px-4 py-2 text-sm text-foreground">
                    {tracking.status || "Status unavailable"}
                  </span>
                </div>
              </div>

              {!tracking.shipment ? (
                <div className="rounded-[32px] border border-border bg-background p-8 shadow-card">
                  <div className="flex items-start gap-4">
                    <Package aria-hidden="true" className="mt-1 h-5 w-5 text-gold" />
                    <div>
                      <h2 className="font-serif text-xl text-foreground">Shipment updates not available yet</h2>
                      <p className="mt-2 text-sm text-muted-foreground">Courier tracking will appear here when shipment information is available.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TrackingInfo label="Current shipment status" value={tracking.shipment.currentStatus || "No carrier update"} />
                    <TrackingInfo label="AWB number" value={tracking.shipment.awbCode || "Not assigned"} />
                    <TrackingInfo label="Courier" value={tracking.shipment.courierName || "Not available"} />
                    <TrackingInfo
                      label="Estimated delivery"
                      value={formatDate(tracking.shipment.estimatedDeliveryAt) || "Not provided"}
                    />
                  </div>

                  <div className="rounded-[32px] border border-border bg-background p-6 shadow-card md:p-8">
                    <div className="flex items-center gap-3">
                      <Truck aria-hidden="true" className="h-5 w-5 text-gold" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider-luxury text-gold">Shipment timeline</p>
                        <h2 className="mt-1 font-serif text-2xl text-foreground">Carrier events</h2>
                      </div>
                    </div>
                    {tracking.shipment.events.length === 0 ? (
                      <p className="mt-6 text-sm text-muted-foreground">No carrier tracking updates are available yet.</p>
                    ) : (
                      <ol className="mt-8 space-y-6">
                        {tracking.shipment.events.map((item) => (
                          <li key={item.id} className="flex gap-4">
                            <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
                              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1 border-b border-border pb-5">
                              <p className="font-medium text-foreground">{item.status || item.activity || "Shipment update"}</p>
                              {item.activity && item.activity !== item.status && (
                                <p className="mt-1 text-sm text-muted-foreground">{item.activity}</p>
                              )}
                              {item.location && <p className="mt-1 text-sm text-muted-foreground">{item.location}</p>}
                              <p className="mt-2 text-xs text-muted-foreground">
                                {formatDate(item.occurredAt) || "Carrier did not provide an event time"}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </PageShell>
    </>
  );
}

function TrackingInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-background p-5 shadow-card">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-3 break-words text-base text-foreground">{value}</p>
    </div>
  );
}

export default TrackOrderPage;
