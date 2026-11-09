import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ExternalLink, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { adminApiFetch } from "@/lib/admin-api";
import { toast } from "sonner";

type Operation = {
  id: number;
  operationType: string;
  status: string;
  requestSubmissionStage: string;
  attemptCount: number;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  createdAt?: string;
};

type Manifest = {
  id: number;
  status: string;
  shiprocketManifestId?: string | null;
  manifestUrl?: string | null;
  generatedAt?: string | null;
  printUrl?: string | null;
  printedAt?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  operations?: Operation[];
};

type ShipmentDetails = {
  id: number;
  status: string;
  shiprocketOrderId?: string | null;
  shiprocketShipmentId?: string | null;
  awbCode?: string | null;
  courierName?: string | null;
  trackingStatus?: string | null;
  trackingStatusAt?: string | null;
  estimatedDeliveryAt?: string | null;
  labelUrl?: string | null;
  labelGeneratedAt?: string | null;
  pickupRequestedAt?: string | null;
  pickupEstimatedAt?: string | null;
  pickupProviderReference?: string | null;
  operations: Operation[];
  trackingEvents: Array<{
    id: number;
    status?: string | null;
    activity?: string | null;
    location?: string | null;
    occurredAt?: string | null;
  }>;
  manifestItems: Array<{ manifest: Manifest }>;
};

type PackageConfirmation = {
  packageWeightKg?: string | number | null;
  packageLengthCm?: string | number | null;
  packageBreadthCm?: string | number | null;
  packageHeightCm?: string | number | null;
  packageConfirmedAt?: string | null;
  packageConfirmedById?: number | null;
  packageConfirmedBy?: { id: number; name?: string | null } | null;
  attemptCount?: number;
  processingStartedAt?: string | null;
  processingLeaseToken?: string | null;
  status?: string;
  shiprocketOrderId?: string | null;
  shiprocketShipmentId?: string | null;
};

const PACKAGE_FIELDS = [
  {
    name: "packageWeightKg",
    label: "Package weight",
    unit: "kg",
    min: "0.001",
    max: "99999.999",
    step: "0.001",
    maxDecimals: 3,
  },
  {
    name: "packageLengthCm",
    label: "Package length",
    unit: "cm",
    min: "0.51",
    max: "999999.99",
    step: "0.01",
    maxDecimals: 2,
  },
  {
    name: "packageBreadthCm",
    label: "Package breadth",
    unit: "cm",
    min: "0.51",
    max: "999999.99",
    step: "0.01",
    maxDecimals: 2,
  },
  {
    name: "packageHeightCm",
    label: "Package height",
    unit: "cm",
    min: "0.51",
    max: "999999.99",
    step: "0.01",
    maxDecimals: 2,
  },
] as const;

const getPackageMeasurementError = (value: string, field: (typeof PACKAGE_FIELDS)[number]) => {
  if (value.length > 32 || !/^\d+(?:\.\d+)?$/.test(value)) {
    return `${field.label} must be a decimal number without signs or spaces.`;
  }

  const fraction = value.split(".")[1] ?? "";
  if (fraction.length > field.maxDecimals) {
    return `${field.label} allows at most ${field.maxDecimals} decimal places.`;
  }

  const numericValue = Number(value);
  if (
    !Number.isFinite(numericValue) ||
    numericValue < Number(field.min) ||
    numericValue > Number(field.max)
  ) {
    return `${field.label} must be between ${field.min} and ${field.max} ${field.unit}.`;
  }

  return "";
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

const isReconciliationRequired = (status?: string) => status === "RECONCILIATION_REQUIRED";

class ShipmentRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ShipmentRequestError";
  }
}

async function shipmentRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await adminApiFetch(`/api/admin${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    throw new ShipmentRequestError(
      body?.message || "Unable to complete shipment operation.",
      response.status,
    );
  }
  if (body?.outcome === "RECONCILIATION_REQUIRED") {
    toast.error("Provider outcome needs reconciliation before retrying.", { className: "luxury-toast" });
  } else if (body?.outcome === "SUCCEEDED") {
    toast.success("Shipment operation completed.", { className: "luxury-toast" });
  } else if (body?.outcome && !["PROCESSING", "ALREADY_SUCCEEDED"].includes(body.outcome)) {
    toast.message(`Shipment operation: ${body.outcome.replaceAll("_", " ").toLowerCase()}`, { className: "luxury-toast" });
  }
  return body;
}

function ShipmentManagementPanel({
  shipmentId,
  orderId,
  initialPackage,
}: {
  shipmentId: number;
  orderId: number;
  initialPackage: PackageConfirmation;
}) {
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [courierId, setCourierId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [packageError, setPackageError] = useState("");
  const [packageInfo, setPackageInfo] = useState<PackageConfirmation>(initialPackage);
  const [packageLocked, setPackageLocked] = useState(false);
  const packageSubmitting = useRef(false);
  const [packageMeasurements, setPackageMeasurements] = useState(() => ({
    packageWeightKg:
      initialPackage.packageWeightKg == null ? "" : String(initialPackage.packageWeightKg),
    packageLengthCm:
      initialPackage.packageLengthCm == null ? "" : String(initialPackage.packageLengthCm),
    packageBreadthCm:
      initialPackage.packageBreadthCm == null ? "" : String(initialPackage.packageBreadthCm),
    packageHeightCm:
      initialPackage.packageHeightCm == null ? "" : String(initialPackage.packageHeightCm),
  }));
  const packageMeasurementErrors = Object.fromEntries(
    PACKAGE_FIELDS.map((field) => [
      field.name,
      getPackageMeasurementError(packageMeasurements[field.name], field),
    ]),
  );
  const packageMeasurementsValid = PACKAGE_FIELDS.every(
    (field) => !packageMeasurementErrors[field.name],
  );
  const packageConfirmed = Boolean(packageInfo.packageConfirmedAt);
  const packageImmutable =
    packageLocked ||
    packageInfo.status === "PROCESSING" ||
    (packageInfo.attemptCount ?? 0) > 0 ||
    Boolean(packageInfo.processingStartedAt || packageInfo.processingLeaseToken) ||
    Boolean(packageInfo.shiprocketOrderId || packageInfo.shiprocketShipmentId) ||
    shipment?.status === "PROCESSING" ||
    Boolean(shipment?.shiprocketOrderId || shipment?.shiprocketShipmentId);

  const refresh = useCallback(async () => {
    try {
      setError("");
      const body = await shipmentRequest(`/shipments/${shipmentId}/operations`);
      setShipment(body.shipment as ShipmentDetails);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load shipment operations.");
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runOperation = async (path: string, body?: unknown) => {
    try {
      setBusy(true);
      await shipmentRequest(path, {
        method: "POST",
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      await refresh();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Shipment operation failed.", { className: "luxury-toast" });
    } finally {
      setBusy(false);
    }
  };

  const confirmPackage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || packageSubmitting.current || packageConfirmed || packageImmutable) return;

    const validationErrors = Object.fromEntries(
      PACKAGE_FIELDS.map((field) => [
        field.name,
        getPackageMeasurementError(packageMeasurements[field.name], field),
      ]),
    );
    if (PACKAGE_FIELDS.some((field) => validationErrors[field.name])) return;

    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      packageSubmitting.current = true;
      setBusy(true);
      setPackageError("");
      const body = await shipmentRequest(`/orders/${orderId}/shipment/package-confirmation`, {
        method: "PUT",
        body: JSON.stringify(packageMeasurements),
      });
      if (!body?.shipment) throw new Error("Package confirmation response was incomplete.");
      setPackageInfo((current) => ({ ...current, ...body.shipment }));
      toast.success("Package measurements confirmed.", { className: "luxury-toast" });
      await refresh();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to confirm package measurements.";
      if (requestError instanceof ShipmentRequestError && requestError.statusCode === 409) {
        setPackageLocked(true);
      }
      await refresh();
      setPackageError(message);
      toast.error(message, { className: "luxury-toast" });
    } finally {
      packageSubmitting.current = false;
      setBusy(false);
    }
  };

  if (loading) {
    return <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-[#64748B]">Loading shipment details...</section>;
  }
  if (error && !shipment) {
    return (
      <section className="rounded-[24px] border border-rose-200 bg-white p-6">
        <p role="alert" className="text-sm text-rose-700">{error}</p>
        <button type="button" onClick={() => { setLoading(true); void refresh(); }} className="mt-3 text-sm font-semibold text-[#041E42]">Try again</button>
      </section>
    );
  }
  if (!shipment) return null;

  const manifests = shipment.manifestItems?.map(({ manifest }) => manifest) ?? [];
  const labelOperation = shipment.operations.find((operation) => operation.operationType === "GENERATE_LABEL");
  const pickupOperation = shipment.operations.find((operation) => operation.operationType === "REQUEST_PICKUP");
  const operationNeedsAttention = shipment.operations.some((operation) => (
    operation.status === "FAILED" || isReconciliationRequired(operation.status)
  ));

  return (
    <section className="space-y-5 rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-32px_rgba(4,30,66,0.28)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#D4AF37]">Fulfillment</p>
          <h3 className="mt-2 text-xl font-semibold text-[#041E42]">Shipment #{shipment.id}</h3>
        </div>
        <button type="button" onClick={() => { setLoading(true); void refresh(); }} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-[#041E42] disabled:opacity-50">
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

      {operationNeedsAttention && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p>One or more provider operations failed or require reconciliation. Do not retry an uncertain submission until it has been checked with the provider.</p>
        </div>
      )}

      <section
        className="space-y-4 border-t border-slate-100 pt-5"
        aria-labelledby="package-confirmation-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 id="package-confirmation-heading" className="font-semibold text-[#041E42]">
              Package measurements
            </h4>
            <p className="mt-1 text-sm text-[#64748B]">
              Required before this shipment can enter processing.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              packageConfirmed
                ? "bg-emerald-50 text-emerald-800"
                : packageImmutable
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {packageConfirmed ? "Confirmed" : packageImmutable ? "Locked" : "Not confirmed"}
          </span>
        </div>

        {packageConfirmed ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PACKAGE_FIELDS.map((field) => (
                <div key={field.name} className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-[#64748B]">
                    {field.label} ({field.unit})
                  </dt>
                  <dd className="mt-2 text-sm font-medium text-[#041E42]">
                    {packageInfo[field.name] == null
                      ? "Not available"
                      : String(packageInfo[field.name])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-[#64748B]">
              Confirmed {formatDate(packageInfo.packageConfirmedAt)}
              {packageInfo.packageConfirmedBy?.name
                ? ` by ${packageInfo.packageConfirmedBy.name}`
                : ""}
            </p>
          </>
        ) : packageImmutable ? (
          <p
            role="status"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Package measurements cannot be confirmed or changed because shipment processing has
            started or provider identifiers are recorded.
          </p>
        ) : (
          <form onSubmit={confirmPackage} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PACKAGE_FIELDS.map((field) => (
                <label key={field.name} className="text-xs font-medium text-[#475569]">
                  {field.label} ({field.unit})
                  <input
                    type="number"
                    name={field.name}
                    required
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={packageMeasurements[field.name]}
                    aria-invalid={Boolean(packageMeasurementErrors[field.name])}
                    aria-describedby={`${field.name}-error`}
                    onChange={(inputEvent) =>
                      setPackageMeasurements((current) => ({
                        ...current,
                        [field.name]: inputEvent.target.value,
                      }))
                    }
                    disabled={busy}
                    className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                  />
                  {packageMeasurementErrors[field.name] && (
                    <span id={`${field.name}-error`} className="mt-1 block text-xs text-rose-700">
                      {packageMeasurementErrors[field.name]}
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="text-xs text-[#64748B]">
              Weight must be greater than 0 kg. Each dimension must be greater than 0.5 cm.
            </p>
            {packageError && (
              <p role="alert" className="text-sm text-rose-700">
                {packageError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !packageMeasurementsValid}
              className="rounded-full bg-[#041E42] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#072e63] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Confirming..." : "Confirm package measurements"}
            </button>
          </form>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Current shipment status" value={shipment.trackingStatus || "No carrier update"} />
        <Info label="Fulfillment queue status" value={shipment.status || "Not available"} />
        <Info label="Shiprocket order ID" value={shipment.shiprocketOrderId || "Not created"} />
        <Info label="Shiprocket shipment ID" value={shipment.shiprocketShipmentId || "Not created"} />
        <Info label="AWB" value={shipment.awbCode || "Not assigned"} />
        <Info label="Courier" value={shipment.courierName || "Not assigned"} />
        <Info label="Estimated delivery" value={formatDate(shipment.estimatedDeliveryAt)} />
        <Info label="Label generation status" value={shipment.labelUrl ? "Generated" : labelOperation?.status || "Not generated"} />
        <Info label="Label generated" value={formatDate(shipment.labelGeneratedAt)} />
        <Info label="Pickup status" value={shipment.pickupRequestedAt ? "Requested" : pickupOperation?.status || "Not requested"} />
        <Info label="Pickup requested" value={formatDate(shipment.pickupRequestedAt)} />
        <Info label="Estimated pickup" value={formatDate(shipment.pickupEstimatedAt)} />
        <Info label="Manifest status" value={manifests.length ? manifests.map((manifest) => manifest.status).join(", ") : "Not generated"} />
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
        {!shipment.awbCode && (
          <>
            <label className="text-xs font-medium text-[#475569]">
              Courier company ID (optional)
              <input
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                inputMode="numeric"
                placeholder="Courier ID"
                className="mt-1 block w-40 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <ActionButton disabled={busy} onClick={() => {
              const normalized = courierId.trim();
              void runOperation(`/shipments/${shipment.id}/awb`, normalized ? { courierId: Number(normalized) } : {});
            }}>Assign AWB</ActionButton>
          </>
        )}
        {shipment.awbCode && !shipment.labelUrl && (
          <ActionButton disabled={busy} onClick={() => void runOperation(`/shipments/${shipment.id}/label`)}>Generate label</ActionButton>
        )}
        {shipment.awbCode && !shipment.pickupRequestedAt && (
          <ActionButton disabled={busy} onClick={() => void runOperation(`/shipments/${shipment.id}/pickup`)}>Request pickup</ActionButton>
        )}
        {shipment.pickupRequestedAt && manifests.length === 0 && (
          <ActionButton disabled={busy} onClick={() => void runOperation("/manifests", { shipmentIds: [shipment.id] })}>Generate manifest</ActionButton>
        )}
      </div>

      {shipment.labelUrl && (
        <div className="flex flex-wrap gap-4 text-sm">
          <DocumentLink href={shipment.labelUrl} label="Open shipping label" />
        </div>
      )}

      {manifests.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-5">
          <h4 className="font-semibold text-[#041E42]">Manifest history</h4>
          {manifests.map((manifest) => (
            <div key={manifest.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#041E42]">
                  <PackageCheck aria-hidden="true" className="h-4 w-4 text-[#D4AF37]" />
                  Manifest #{manifest.id}: {manifest.status}
                </div>
                {manifest.status === "GENERATED" && !manifest.printUrl && (
                  <ActionButton disabled={busy} onClick={() => void runOperation(`/manifests/${manifest.id}/print`)}>Print manifest</ActionButton>
                )}
              </div>
              {manifest.shiprocketManifestId && <p className="mt-2 text-xs text-[#64748B]">Provider ID: {manifest.shiprocketManifestId}</p>}
              {manifest.lastErrorMessage && <p className="mt-2 text-sm text-rose-700">{manifest.lastErrorMessage}</p>}
              {(manifest.manifestUrl || manifest.printUrl) && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {manifest.manifestUrl && <DocumentLink href={manifest.manifestUrl} label="Open manifest" />}
                  {manifest.printUrl && <DocumentLink href={manifest.printUrl} label="Open printed manifest" />}
                </div>
              )}
              {manifest.operations?.map((operation) => <OperationStatus key={operation.id} operation={operation} />)}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 pt-5">
        <h4 className="font-semibold text-[#041E42]">Provider operations</h4>
        {shipment.operations.length === 0 ? (
          <p className="mt-3 text-sm text-[#64748B]">No shipment operations recorded.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {shipment.operations.map((operation) => <OperationStatus key={operation.id} operation={operation} />)}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h4 className="flex items-center gap-2 font-semibold text-[#041E42]">
          <Truck aria-hidden="true" className="h-4 w-4 text-[#D4AF37]" /> Tracking event history
        </h4>
        {shipment.trackingEvents.length === 0 ? (
          <p className="mt-3 text-sm text-[#64748B]">No tracking events received.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {shipment.trackingEvents.map((event) => (
              <li key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-medium text-[#041E42]">{event.status || event.activity || "Shipment update"}</p>
                {event.activity && event.activity !== event.status && <p className="mt-1 text-sm text-[#475569]">{event.activity}</p>}
                {event.location && <p className="mt-1 text-sm text-[#475569]">{event.location}</p>}
                <p className="mt-2 text-xs text-[#64748B]">{formatDate(event.occurredAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function OperationStatus({ operation }: { operation: Operation }) {
  const attention = operation.status === "FAILED" || isReconciliationRequired(operation.status);
  return (
    <div className={`mt-2 rounded-xl border p-3 text-xs ${attention ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}>
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-semibold text-[#041E42]">{operation.operationType.replaceAll("_", " ")}</span>
        <span className={attention ? "font-semibold text-amber-800" : "text-[#475569]"}>{operation.status.replaceAll("_", " ")}</span>
      </div>
      <p className="mt-1 text-[#64748B]">Attempt {operation.attemptCount} · {operation.requestSubmissionStage.replaceAll("_", " ")}</p>
      {operation.lastErrorMessage && <p className="mt-2 text-rose-700">{operation.lastErrorMessage}</p>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#64748B]">{label}</p>
      <p className="mt-2 break-all text-sm font-medium text-[#041E42]">{value}</p>
    </div>
  );
}

function ActionButton({ children, disabled, onClick }: { children: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="rounded-full bg-[#041E42] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#072e63] disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

function DocumentLink({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#041E42] underline decoration-[#D4AF37] underline-offset-4">{label}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></a>;
}

export default ShipmentManagementPanel;
