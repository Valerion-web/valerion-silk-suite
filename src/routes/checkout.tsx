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
import { useShop, type CartItem } from "@/lib/store";

type BackendCartItem = {
  id: number;
  productId: number;
  variantId: number | null;
  quantity: number;
};

type PrepaidCartContext = {
  cart: CartItem[];
  user: { id?: number | string; role: string } | null;
  authHydrated: boolean;
};

type CartRequest = typeof apiFetch;

const cartIdentityKey = (productId: number, variantId: number | null) =>
  `${productId}:${variantId ?? "none"}`;

async function readBackendCart(request: CartRequest): Promise<BackendCartItem[]> {
  const response = await request("/api/cart");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Unable to read your saved cart.",
    );
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error("The saved cart response was invalid. Prepaid checkout is unavailable.");
  }

  const seen = new Set<string>();
  return data.items.map((item: unknown) => {
    if (!item || typeof item !== "object") {
      throw new Error("The saved cart contains an item with invalid identity.");
    }
    const line = item as Record<string, unknown>;
    const product = line.product;
    const variant = line.variant;
    if (
      !Number.isSafeInteger(line.id) ||
      Number(line.id) <= 0 ||
      !product ||
      typeof product !== "object" ||
      !Number.isSafeInteger((product as Record<string, unknown>).id) ||
      Number((product as Record<string, unknown>).id) <= 0 ||
      !Number.isSafeInteger(line.quantity) ||
      Number(line.quantity) < 1
    ) {
      throw new Error("The saved cart contains an item with invalid identity or quantity.");
    }

    const productId = Number((product as Record<string, unknown>).id);
    let variantId: number | null = null;
    if (variant != null) {
      if (
        typeof variant !== "object" ||
        !Number.isSafeInteger((variant as Record<string, unknown>).id) ||
        Number((variant as Record<string, unknown>).id) <= 0 ||
        (variant as Record<string, unknown>).productId !== productId
      ) {
        throw new Error("The saved cart contains a variant that cannot be verified.");
      }
      variantId = Number((variant as Record<string, unknown>).id);
    }

    const key = cartIdentityKey(productId, variantId);
    if (seen.has(key)) {
      throw new Error("The saved cart contains duplicate product options.");
    }
    seen.add(key);
    return {
      id: Number(line.id),
      productId,
      variantId,
      quantity: Number(line.quantity),
    };
  });
}

async function readErrorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return data && typeof data.message === "string" ? data.message : fallback;
}

async function synchronizePrepaidCart(
  { cart, user, authHydrated }: PrepaidCartContext,
  request: CartRequest = apiFetch,
): Promise<void> {
  if (!authHydrated || !user || user.role !== "CUSTOMER") {
    throw new Error("Sign in with a customer account before preparing a prepaid cart.");
  }
  if (cart.length === 0) throw new Error("Your cart is empty.");

  const desiredByIdentity = new Map<
    string,
    { productId: number; variantId: number | null; quantity: number }
  >();
  for (const item of cart) {
    const productId = item.backendProductId;
    const variantId = item.backendVariantId ?? null;
    if (
      item.backendIdentity !== "verified" ||
      !Number.isSafeInteger(productId) ||
      Number(productId) <= 0 ||
      (variantId !== null && (!Number.isSafeInteger(variantId) || variantId <= 0))
    ) {
      throw new Error("A cart item has no verified backend product and variant identity.");
    }
    if (!Number.isSafeInteger(item.qty) || item.qty < 1) {
      throw new Error("A cart item has an invalid quantity.");
    }
    const key = cartIdentityKey(Number(productId), variantId);
    if (desiredByIdentity.has(key)) {
      throw new Error(
        "The local cart contains duplicate product options that cannot be reconciled safely.",
      );
    }
    desiredByIdentity.set(key, {
      productId: Number(productId),
      variantId,
      quantity: item.qty,
    });
  }

  const initialItems = await readBackendCart(request);
  const initialByIdentity = new Map(
    initialItems.map((item) => [cartIdentityKey(item.productId, item.variantId), item]),
  );
  const extras = initialItems.filter(
    (item) => !desiredByIdentity.has(cartIdentityKey(item.productId, item.variantId)),
  );
  if (extras.length > 0) {
    throw new Error(
      "Your saved cart has other items. Remove or resolve them before preparing a prepaid cart; no saved items were deleted.",
    );
  }

  let mutationError: string | null = null;
  for (const [key, desired] of desiredByIdentity) {
    const existing = initialByIdentity.get(key);
    if (existing?.quantity === desired.quantity) continue;

    try {
      const response = existing
        ? await request(`/api/cart/items/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: desired.quantity }),
          })
        : await request("/api/cart/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: desired.productId,
              variantId: desired.variantId,
              quantity: desired.quantity,
            }),
          });
      if (!response.ok) {
        mutationError = await readErrorMessage(
          response,
          "A saved cart update was rejected. The cart will be checked before retrying.",
        );
        break;
      }
    } catch {
      mutationError =
        "A cart update could not be confirmed. The cart will be checked before any further changes.";
      break;
    }
  }

  let verifiedItems: BackendCartItem[];
  try {
    verifiedItems = await readBackendCart(request);
  } catch {
    throw new Error(
      mutationError
        ? `${mutationError} The final cart could not be verified; do not retry an uncertain add until you check the saved cart.`
        : "The saved cart could not be verified after synchronization. Prepaid checkout is unavailable.",
    );
  }

  const verifiedByIdentity = new Map(
    verifiedItems.map((item) => [cartIdentityKey(item.productId, item.variantId), item]),
  );
  const exactMatch =
    verifiedItems.length === desiredByIdentity.size &&
    [...desiredByIdentity].every(([key, desired]) => {
      const actual = verifiedByIdentity.get(key);
      return actual?.quantity === desired.quantity;
    });
  if (!exactMatch) {
    throw new Error(
      mutationError
        ? `${mutationError} The saved cart still differs from your selection. Review it before trying again.`
        : "Your saved cart does not exactly match your selection. Prepaid checkout is blocked; review your saved cart.",
    );
  }
}

function createPrepaidCartSynchronizer(request: CartRequest = apiFetch) {
  let inFlight: { key: string; promise: Promise<void> } | null = null;
  return (context: PrepaidCartContext) => {
    const key = JSON.stringify({
      userId: context.user?.id ?? null,
      role: context.user?.role ?? null,
      authHydrated: context.authHydrated,
      cart: context.cart.map((item) => [
        item.id,
        item.qty,
        item.backendProductId ?? null,
        item.backendVariantId ?? null,
        item.backendIdentity,
      ]),
    });
    if (inFlight) {
      if (inFlight.key === key) return inFlight.promise;
      return Promise.reject(
        new Error("A different cart verification is already running. Please wait and try again."),
      );
    }

    const current = synchronizePrepaidCart(context, request).finally(() => {
      if (inFlight?.promise === current) inFlight = null;
    });
    inFlight = { key, promise: current };
    return current;
  };
}

type RazorpayOrder = {
  paymentId: number;
  paymentAttemptKey: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
};

type RazorpayCallback = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayPendingAttempt = {
  version: 1;
  fingerprint: string;
  idempotencyKey: string;
  paymentAttemptKey: string;
  orderRequestStarted: boolean;
  terminal?: boolean;
  order?: RazorpayOrder;
  verification?: RazorpayCallback;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  handler: (result: RazorpayCallback) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (result: unknown) => void) => void;
};

type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;
type RazorpayStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RazorpayFlowContext = {
  context: PrepaidCartContext;
  fingerprint: string;
  storageKey: string;
  shippingAddress: CheckoutAddress;
  billingAddress: CheckoutAddress;
  couponCode?: string;
};
type RazorpayFlowCallbacks = {
  onPendingChange: (attempt: RazorpayPendingAttempt | null) => void;
  onModalOpen: () => void;
  onModalClose: () => void;
  onMessage: (message: string) => void;
  onVerified: (orderId: number) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpaySdkPromise: Promise<RazorpayConstructor> | null = null;

function loadRazorpaySdk(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout is available only in a browser."));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (razorpaySdkPromise) return razorpaySdkPromise;

  razorpaySdkPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (!script) {
      script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
    }

    const handleLoad = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout SDK loaded without its browser interface."));
    };
    const handleError = () =>
      reject(new Error("Unable to load Razorpay Checkout. Check your connection and retry."));
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  }).catch((error: unknown) => {
    razorpaySdkPromise = null;
    throw error;
  });

  return razorpaySdkPromise;
}

function readRazorpayPendingAttempt(
  storage: RazorpayStorage,
  storageKey: string,
): RazorpayPendingAttempt | null {
  const raw = storage.getItem(storageKey);
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(
      "A saved prepaid payment attempt is unreadable. Do not start another checkout; contact support.",
    );
  }
  if (!value || typeof value !== "object") {
    throw new Error(
      "A saved prepaid payment attempt is invalid. Do not start another checkout; contact support.",
    );
  }

  const attempt = value as Partial<RazorpayPendingAttempt>;
  if (
    attempt.version !== 1 ||
    typeof attempt.fingerprint !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(attempt.idempotencyKey ?? "") ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(attempt.paymentAttemptKey ?? "") ||
    typeof attempt.orderRequestStarted !== "boolean" ||
    (attempt.terminal !== undefined && typeof attempt.terminal !== "boolean") ||
    attempt.idempotencyKey === attempt.paymentAttemptKey
  ) {
    throw new Error(
      "A saved prepaid payment attempt is invalid. Do not start another checkout; contact support.",
    );
  }
  if (
    attempt.order &&
    (!Number.isSafeInteger(attempt.order.paymentId) ||
      attempt.order.paymentId < 1 ||
      attempt.order.paymentAttemptKey !== attempt.paymentAttemptKey ||
      !/^order_[A-Za-z0-9_-]{1,128}$/.test(attempt.order.razorpayOrderId) ||
      !Number.isSafeInteger(attempt.order.amount) ||
      attempt.order.amount < 1 ||
      attempt.order.currency !== "INR")
  ) {
    throw new Error(
      "The saved prepaid order details are invalid. Do not start another checkout; contact support.",
    );
  }
  if (
    attempt.verification &&
    (typeof attempt.verification.razorpay_payment_id !== "string" ||
      typeof attempt.verification.razorpay_order_id !== "string" ||
      typeof attempt.verification.razorpay_signature !== "string")
  ) {
    throw new Error(
      "The saved payment verification is invalid. Do not start another checkout; contact support.",
    );
  }
  return attempt as RazorpayPendingAttempt;
}

const requestWithTimeout = async (
  request: CartRequest,
  url: string,
  init: RequestInit,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await request(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const readResponseData = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const responseMessage = (data: unknown, fallback: string) =>
  data && typeof data === "object" && "message" in data && typeof data.message === "string"
    ? data.message
    : fallback;

function createRazorpayCheckoutFlow({
  request = apiFetch,
  synchronize,
  loadSdk = loadRazorpaySdk,
  getStorage = () => window.localStorage,
  publicKey,
  timeoutMs = 30_000,
}: {
  request?: CartRequest;
  synchronize: ReturnType<typeof createPrepaidCartSynchronizer>;
  loadSdk?: () => Promise<RazorpayConstructor>;
  getStorage?: () => RazorpayStorage;
  publicKey: string;
  timeoutMs?: number;
}) {
  let verificationInFlight: { key: string; promise: Promise<void> } | null = null;
  const completedAttempts = new Set<string>();

  const verify = (
    storage: RazorpayStorage,
    storageKey: string,
    attempt: RazorpayPendingAttempt,
    callback: RazorpayCallback,
    callbacks: RazorpayFlowCallbacks,
  ): Promise<void> => {
    if (completedAttempts.has(attempt.paymentAttemptKey)) return Promise.resolve();
    const verificationKey = JSON.stringify([attempt.paymentAttemptKey, callback]);
    if (verificationInFlight) {
      return verificationInFlight.key === verificationKey
        ? verificationInFlight.promise
        : Promise.reject(new Error("A different payment verification is already in progress."));
    }
    if (
      !attempt.order ||
      callback.razorpay_order_id !== attempt.order.razorpayOrderId ||
      !/^pay_[A-Za-z0-9_-]{1,128}$/.test(callback.razorpay_payment_id) ||
      !/^[a-f0-9]{64}$/i.test(callback.razorpay_signature)
    ) {
      return Promise.reject(
        new Error("Razorpay returned invalid payment details. The attempt remains unresolved."),
      );
    }

    const storedAttempt = { ...attempt, verification: callback };
    try {
      storage.setItem(storageKey, JSON.stringify(storedAttempt));
      callbacks.onPendingChange(storedAttempt);
    } catch {
      return Promise.reject(
        new Error(
          "Payment details could not be saved for safe verification retry. Keep this page open and contact support.",
        ),
      );
    }

    const current = (async () => {
      let response: Response;
      try {
        response = await requestWithTimeout(
          request,
          "/api/payments/razorpay/verify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentId: attempt.order!.paymentId,
              razorpay_payment_id: callback.razorpay_payment_id,
              razorpay_order_id: callback.razorpay_order_id,
              razorpay_signature: callback.razorpay_signature,
              idempotencyKey: attempt.idempotencyKey,
            }),
          },
          timeoutMs,
        );
      } catch {
        throw new Error(
          "Payment verification could not be confirmed. Your attempt is saved; retry verification using the same payment details.",
        );
      }

      const data = await readResponseData(response);
      if (!response.ok) {
        if (response.status === 400) {
          const retryableAttempt = { ...attempt, verification: undefined };
          storage.setItem(storageKey, JSON.stringify(retryableAttempt));
          callbacks.onPendingChange(retryableAttempt);
        }
        throw new Error(
          responseMessage(
            data,
            "Payment verification failed. Your attempt remains unresolved; retry safely or contact support.",
          ),
        );
      }
      if (data?.success !== true || !Number.isSafeInteger(data.orderId) || data.orderId < 1) {
        throw new Error(
          "The server did not confirm order finalization. Your cart is unchanged; retry verification.",
        );
      }

      callbacks.onVerified(data.orderId);
      completedAttempts.add(attempt.paymentAttemptKey);
      try {
        storage.removeItem(storageKey);
        callbacks.onPendingChange(null);
      } catch {
        callbacks.onMessage(
          "Your payment and order were verified, but this browser could not clear its saved recovery record.",
        );
      }
    })().finally(() => {
      if (verificationInFlight?.promise === current) verificationInFlight = null;
    });
    verificationInFlight = { key: verificationKey, promise: current };
    return current;
  };

  return {
    async start(
      input: RazorpayFlowContext,
      callbacks: RazorpayFlowCallbacks,
      { newPaymentAttempt = false }: { newPaymentAttempt?: boolean } = {},
    ) {
      if (!input.context.authHydrated || input.context.user?.role !== "CUSTOMER") {
        throw new Error("Sign in with a customer account before making a prepaid payment.");
      }

      const execute = async () => {
        const storage = getStorage();
        let attempt = readRazorpayPendingAttempt(storage, input.storageKey);
        if (attempt?.verification) {
          return verify(storage, input.storageKey, attempt, attempt.verification, callbacks);
        }
        if (attempt?.terminal) {
          if (!newPaymentAttempt) {
            throw new Error(
              "The server confirmed that this payment attempt is terminal. Choose “Start new payment attempt” to retry.",
            );
          }
          if (attempt.fingerprint !== input.fingerprint) {
            throw new Error(
              "Restore the original cart and delivery details before starting a new payment attempt.",
            );
          }
          attempt = {
            version: 1,
            fingerprint: attempt.fingerprint,
            idempotencyKey: attempt.idempotencyKey,
            paymentAttemptKey: `attempt-${window.crypto.randomUUID()}`,
            orderRequestStarted: false,
          };
          storage.setItem(input.storageKey, JSON.stringify(attempt));
          callbacks.onPendingChange(attempt);
        } else if (newPaymentAttempt) {
          throw new Error(
            "A new payment attempt is available only after the server confirms the prior attempt is terminal.",
          );
        }
        if (attempt && attempt.fingerprint !== input.fingerprint) {
          if (attempt.orderRequestStarted || attempt.order || attempt.verification) {
            throw new Error(
              "A previous prepaid attempt is unresolved. Restore its original cart and delivery details before retrying.",
            );
          }
          storage.removeItem(input.storageKey);
          callbacks.onPendingChange(null);
          attempt = null;
        }
        if (!publicKey)
          throw new Error("Razorpay is unavailable because the public key is not configured.");

        if (!attempt) {
          const idempotencyKey = `checkout-${window.crypto.randomUUID()}`;
          let paymentAttemptKey = `attempt-${window.crypto.randomUUID()}`;
          if (paymentAttemptKey === idempotencyKey)
            paymentAttemptKey = `attempt-${window.crypto.randomUUID()}`;
          attempt = {
            version: 1,
            fingerprint: input.fingerprint,
            idempotencyKey,
            paymentAttemptKey,
            orderRequestStarted: false,
          };
          try {
            storage.setItem(input.storageKey, JSON.stringify(attempt));
          } catch {
            throw new Error(
              "This browser cannot persist a payment attempt safely. Prepaid checkout is unavailable.",
            );
          }
          callbacks.onPendingChange(attempt);
        }

        const Razorpay = await loadSdk();
        await synchronize(input.context);

        const body = {
          idempotencyKey: attempt.idempotencyKey,
          paymentAttemptKey: attempt.paymentAttemptKey,
          expectedCart: input.context.cart.map((item) => ({
            productId: item.backendProductId,
            variantId: item.backendVariantId ?? null,
            quantity: item.qty,
          })),
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress,
          ...(input.couponCode?.trim() ? { couponCode: input.couponCode.trim() } : {}),
        };
        attempt = { ...attempt, orderRequestStarted: true };
        storage.setItem(input.storageKey, JSON.stringify(attempt));
        callbacks.onPendingChange(attempt);
        let response: Response;
        try {
          response = await requestWithTimeout(
            request,
            "/api/payments/razorpay/order",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
            timeoutMs,
          );
        } catch {
          throw new Error(
            "Order creation could not be confirmed. Retry to safely recover the same payment attempt.",
          );
        }
        const data = await readResponseData(response);
        if (!response.ok) {
          const message = responseMessage(
            data,
            "Unable to create the payment order. Your attempt is preserved for a safe retry.",
          );
          if (
            response.status === 409 &&
            message === "This payment attempt is terminal; use a new paymentAttemptKey"
          ) {
            attempt = { ...attempt, terminal: true };
            storage.setItem(input.storageKey, JSON.stringify(attempt));
            callbacks.onPendingChange(attempt);
          }
          if (response.status === 400 && !attempt.order) {
            storage.removeItem(input.storageKey);
            callbacks.onPendingChange(null);
          }
          throw new Error(message);
        }
        if (
          !Number.isSafeInteger(data?.paymentId) ||
          data.paymentId < 1 ||
          data.paymentAttemptKey !== attempt.paymentAttemptKey ||
          !/^order_[A-Za-z0-9_-]{1,128}$/.test(data.razorpayOrderId) ||
          !Number.isSafeInteger(data.amount) ||
          data.amount < 1 ||
          data.currency !== "INR"
        ) {
          throw new Error(
            "The payment order response was invalid. Your attempt is preserved; do not start a new one.",
          );
        }

        const order: RazorpayOrder = {
          paymentId: data.paymentId,
          paymentAttemptKey: data.paymentAttemptKey,
          razorpayOrderId: data.razorpayOrderId,
          amount: data.amount,
          currency: data.currency,
        };
        attempt = { ...attempt, order };
        storage.setItem(input.storageKey, JSON.stringify(attempt));
        callbacks.onPendingChange(attempt);

        const activeAttempt = attempt;
        let verificationStarted = false;
        let paymentFailed = false;
        let markModalClosed: () => void = () => {};
        const modalClosed = new Promise<void>((resolve) => {
          markModalClosed = resolve;
        });
        const closeModal = () => {
          callbacks.onModalClose();
          markModalClosed();
        };
        const instance = new Razorpay({
          key: publicKey,
          amount: order.amount,
          currency: order.currency,
          name: "HASTON",
          description: "Secure prepaid checkout",
          order_id: order.razorpayOrderId,
          prefill: {
            name: input.shippingAddress.name,
            email: input.shippingAddress.email,
            contact: input.shippingAddress.phone,
          },
          handler: (callback) => {
            verificationStarted = true;
            closeModal();
            void verify(storage, input.storageKey, activeAttempt, callback, callbacks).catch(
              (error: unknown) => {
                callbacks.onMessage(
                  error instanceof Error
                    ? error.message
                    : "Payment verification could not be confirmed.",
                );
              },
            );
          },
          modal: {
            ondismiss: () => {
              closeModal();
              if (!verificationStarted && !paymentFailed) {
                callbacks.onMessage(
                  "Payment was not confirmed. Your attempt is saved; retry with the same payment attempt.",
                );
              }
            },
          },
          theme: { color: "#b28a38" },
        });
        instance.on("payment.failed", (failure) => {
          paymentFailed = true;
          const data =
            failure && typeof failure === "object" && "error" in failure
              ? (failure as { error?: { description?: string; reason?: string } }).error
              : undefined;
          callbacks.onMessage(
            data?.description || data?.reason
              ? `Payment was not confirmed: ${data.description || data.reason}. Your attempt is saved; retry using the same attempt.`
              : "Payment was not confirmed. Your attempt is saved; retry using the same attempt.",
          );
        });
        callbacks.onModalOpen();
        try {
          instance.open();
          await modalClosed;
        } catch (error) {
          closeModal();
          throw error;
        }
      };

      if (typeof navigator !== "undefined" && navigator.locks?.request) {
        return navigator.locks.request(`haston-razorpay:${input.storageKey}`, execute);
      }
      return execute();
    },
  };
}

const PAYMENT_METHODS = [
  { id: "razorpay", label: "Pay Online with Razorpay", icon: CreditCard, available: true },
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

const fingerprintPrepaidCheckout = async (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const cartSelectionFingerprint = (items: readonly CartItem[]) =>
  JSON.stringify(
    items.map((item) => [
      item.id,
      item.qty,
      item.size,
      item.color,
      item.backendProductId ?? null,
      item.backendVariantId ?? null,
      item.backendIdentity,
    ]),
  );

const persistedCartSelectionFingerprint = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  return JSON.stringify(
    value.map((item: unknown) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      return [
        entry.id,
        entry.qty,
        entry.size,
        entry.color,
        entry.backendProductId ?? null,
        entry.backendVariantId ?? null,
        entry.backendIdentity,
      ];
    }),
  );
};

function CheckoutPage() {
  const { cart, clearCart } = useShop();
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const { user, hydrated: authHydrated } = useAuth();
  const navigate = useNavigate();
  const razorpayKeyId = String(import.meta.env.VITE_RAZORPAY_KEY_ID || "").trim();
  const prepaidSynchronizerRef = useRef<ReturnType<typeof createPrepaidCartSynchronizer> | null>(
    null,
  );
  const prepaidSyncBusyRef = useRef(false);
  if (!prepaidSynchronizerRef.current) {
    prepaidSynchronizerRef.current = createPrepaidCartSynchronizer();
  }
  const razorpayFlowRef = useRef<ReturnType<typeof createRazorpayCheckoutFlow> | null>(null);
  if (!razorpayFlowRef.current && prepaidSynchronizerRef.current) {
    razorpayFlowRef.current = createRazorpayCheckoutFlow({
      synchronize: prepaidSynchronizerRef.current,
      publicKey: razorpayKeyId,
    });
  }

  const lines = cart
    .map((c) => ({ ...c, product: findProduct(c.id) }))
    .filter((l) => l.product) as Array<{
    id: string;
    qty: number;
    size: string;
    color: string;
    product: NonNullable<ReturnType<typeof findProduct>>;
  }>;

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
  const [placedPaymentMethod, setPlacedPaymentMethod] = useState<"cod" | "razorpay">("cod");
  const [codEligibility, setCodEligibility] = useState<CodEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  const [prepaidSyncing, setPrepaidSyncing] = useState(false);
  const [prepaidReadyFingerprint, setPrepaidReadyFingerprint] = useState<string | null>(null);
  const [prepaidSyncError, setPrepaidSyncError] = useState<string | null>(null);
  const [razorpayPending, setRazorpayPending] = useState<RazorpayPendingAttempt | null>(null);
  const [pendingCod, setPendingCod] = useState(false);
  const [paymentRecoveryLoaded, setPaymentRecoveryLoaded] = useState(false);
  const [paymentRecoveryError, setPaymentRecoveryError] = useState<string | null>(null);
  const [razorpaySdkStatus, setRazorpaySdkStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [razorpaySdkError, setRazorpaySdkError] = useState<string | null>(null);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const submittingRef = useRef(false);
  const pendingRequestRef = useRef<CodRequest | null>(null);
  const razorpayModalOpenRef = useRef(false);
  const checkoutFormRef = useRef<HTMLFormElement>(null);
  const newPaymentAttemptRequestedRef = useRef(false);

  const checkoutItems = lines.map((line) => ({
    slug: line.id,
    size: line.size,
    color: line.color,
    quantity: line.qty,
  }));
  const checkoutItemsFingerprint = JSON.stringify(checkoutItems);
  const prepaidCartFingerprint = JSON.stringify({
    userId: user?.id ?? null,
    items: cart.map((item) => ({
      id: item.id,
      qty: item.qty,
      backendProductId: item.backendProductId ?? null,
      backendVariantId: item.backendVariantId ?? null,
      backendIdentity: item.backendIdentity,
    })),
  });
  const prepaidCartReady = prepaidReadyFingerprint === prepaidCartFingerprint;
  const razorpayAttemptUnresolved = Boolean(
    razorpayPending &&
    (razorpayPending.orderRequestStarted || razorpayPending.order || razorpayPending.verification),
  );

  useEffect(() => {
    if (!authHydrated) return;
    setPaymentRecoveryLoaded(false);
    setPaymentRecoveryError(null);
    if (!user) {
      setRazorpayPending(null);
      setPendingCod(false);
      setPaymentRecoveryLoaded(true);
      return;
    }

    try {
      const pendingAttempt = readRazorpayPendingAttempt(
        window.localStorage,
        `haston.razorpay.pending.${user.id}`,
      );
      const codAttempt = window.sessionStorage.getItem(`haston.cod.pending.${user.id}`);
      setRazorpayPending(pendingAttempt);
      setPendingCod(Boolean(codAttempt));
      if (pendingAttempt) setPay("razorpay");
    } catch (error) {
      setPaymentRecoveryError(
        error instanceof Error
          ? error.message
          : "A previous payment attempt could not be recovered.",
      );
    } finally {
      setPaymentRecoveryLoaded(true);
    }
  }, [authHydrated, user]);

  useEffect(() => {
    if (pay !== "razorpay") {
      setRazorpaySdkStatus("idle");
      setRazorpaySdkError(null);
      return;
    }
    if (!razorpayKeyId) {
      setRazorpaySdkStatus("error");
      setRazorpaySdkError("Razorpay is unavailable because the public key is not configured.");
      return;
    }

    let active = true;
    setRazorpaySdkStatus("loading");
    setRazorpaySdkError(null);
    void loadRazorpaySdk().then(
      () => {
        if (active) setRazorpaySdkStatus("ready");
      },
      (error: unknown) => {
        if (!active) return;
        setRazorpaySdkStatus("error");
        setRazorpaySdkError(
          error instanceof Error ? error.message : "Unable to load Razorpay Checkout.",
        );
      },
    );
    return () => {
      active = false;
    };
  }, [pay, razorpayKeyId]);

  useEffect(() => {
    setPrepaidSyncError(null);
  }, [prepaidCartFingerprint]);

  const verifyPrepaidCart = async () => {
    if (prepaidSyncBusyRef.current) return;
    prepaidSyncBusyRef.current = true;
    setPrepaidSyncError(null);
    setPrepaidReadyFingerprint(null);
    setPrepaidSyncing(true);
    try {
      const synchronizer = prepaidSynchronizerRef.current;
      if (!synchronizer) throw new Error("Prepaid cart synchronization is unavailable.");
      await synchronizer({ cart, user, authHydrated });
      setPrepaidReadyFingerprint(prepaidCartFingerprint);
    } catch (error) {
      setPrepaidSyncError(
        error instanceof Error ? error.message : "The saved cart could not be verified.",
      );
    } finally {
      prepaidSyncBusyRef.current = false;
      setPrepaidSyncing(false);
    }
  };

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
    const newPaymentAttempt = newPaymentAttemptRequestedRef.current;
    newPaymentAttemptRequestedRef.current = false;
    if (submittingRef.current || placed || razorpayModalOpenRef.current) return;
    if (pay === "razorpay") {
      if (!paymentRecoveryLoaded || paymentRecoveryError) {
        setCheckoutError(paymentRecoveryError ?? "Checking for an unresolved payment attempt...");
        return;
      }
      if (!authHydrated || user?.role !== "CUSTOMER") {
        setCheckoutError("Sign in with a customer account before making a prepaid payment.");
        return;
      }
      if (pendingCod) {
        setCheckoutError(
          "A COD request is unresolved. Confirm that order before switching payment methods.",
        );
        return;
      }
      if (!razorpayKeyId && !razorpayPending?.verification) {
        setCheckoutError("Razorpay is unavailable because the public key is not configured.");
        return;
      }
      const flow = razorpayFlowRef.current;
      if (!flow) {
        setCheckoutError("Prepaid checkout is unavailable. Please refresh and try again.");
        return;
      }

      const address: CheckoutAddress = {
        name: ship.name.trim(),
        phone: ship.mobile.trim(),
        email: ship.email.trim(),
        line1: ship.address.trim(),
        line2: ship.apartment.trim() || null,
        city: ship.city.trim(),
        state: ship.state.trim(),
        postalCode: ship.pincode.trim(),
        country: ship.country.trim(),
      };
      const prepaidRequestFingerprint = await fingerprintPrepaidCheckout({
        userId: user.id,
        cart: cart.map((item) => ({
          backendProductId: item.backendProductId ?? null,
          backendVariantId: item.backendVariantId ?? null,
          backendIdentity: item.backendIdentity,
          quantity: item.qty,
        })),
        shippingAddress: address,
        billingAddress: address,
        couponCode: null,
      });
      const originalCartFingerprint = cartSelectionFingerprint(cart);

      submittingRef.current = true;
      setSubmitting(true);
      setCheckoutError(null);
      setRazorpaySdkError(null);
      try {
        await flow.start(
          {
            context: { cart, user, authHydrated },
            fingerprint: prepaidRequestFingerprint,
            storageKey: `haston.razorpay.pending.${user.id}`,
            shippingAddress: address,
            billingAddress: address,
          },
          {
            onPendingChange: setRazorpayPending,
            onModalOpen: () => {
              razorpayModalOpenRef.current = true;
              setRazorpayModalOpen(true);
            },
            onModalClose: () => {
              razorpayModalOpenRef.current = false;
              setRazorpayModalOpen(false);
            },
            onMessage: setCheckoutError,
            onVerified: (orderId) => {
              setPlacedPaymentMethod("razorpay");
              setPlacedOrderId(orderId);
              setPlaced(true);
              let currentCartMatches =
                cartSelectionFingerprint(cartRef.current) === originalCartFingerprint;
              try {
                const persistedCart = window.localStorage.getItem("valerion.cart");
                currentCartMatches =
                  currentCartMatches &&
                  persistedCart !== null &&
                  persistedCartSelectionFingerprint(JSON.parse(persistedCart)) ===
                    originalCartFingerprint;
              } catch {
                currentCartMatches = false;
              }
              if (currentCartMatches) {
                clearCart();
              } else {
                setCheckoutError(
                  "Payment was verified and the order was placed, but your cart changed during checkout and was preserved.",
                );
              }
            },
          },
          { newPaymentAttempt },
        );
      } catch (error) {
        setCheckoutError(
          error instanceof Error ? error.message : "Unable to start prepaid checkout.",
        );
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }
    if (pay !== "cod") return;
    if (!paymentRecoveryLoaded || paymentRecoveryError) {
      setCheckoutError(paymentRecoveryError ?? "Checking for an unresolved payment attempt...");
      return;
    }
    if (razorpayAttemptUnresolved) {
      setCheckoutError(
        "A prepaid payment attempt is unresolved. Retry or verify that attempt before choosing COD.",
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
      setPendingCod(true);
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
          setPendingCod(false);
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
      setPendingCod(false);
      setSubmissionUncertain(false);
      setPlacedPaymentMethod("cod");
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

          <form
            ref={checkoutFormRef}
            onSubmit={placeOrder}
            className="grid lg:grid-cols-[1fr_420px] gap-12"
          >
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
                    const available =
                      m.id === "razorpay"
                        ? Boolean(razorpayKeyId) || Boolean(razorpayPending?.verification)
                        : m.available;
                    const lockedByOtherAttempt =
                      (razorpayAttemptUnresolved && m.id !== "razorpay") ||
                      (pendingCod && m.id !== "cod");
                    return (
                      <button
                        type="button"
                        key={m.id}
                        disabled={
                          !available ||
                          lockedByOtherAttempt ||
                          Boolean(paymentRecoveryError) ||
                          submissionUncertain ||
                          submitting ||
                          !paymentRecoveryLoaded
                        }
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
                          {available ? m.label : `${m.label} — Unavailable`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!razorpayKeyId && (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    Razorpay payments are unavailable because the public key is not configured. Cash
                    on Delivery remains available when no earlier payment is unresolved.
                  </p>
                )}
                {paymentRecoveryError && (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {paymentRecoveryError}
                  </p>
                )}
                {razorpayAttemptUnresolved && (
                  <p role="status" className="mt-4 text-sm text-amber-700">
                    {razorpayPending?.terminal
                      ? "The server confirmed that this payment attempt is terminal. Start a new prepaid attempt to retry; this checkout cannot be switched to COD."
                      : `A prepaid attempt is unresolved. Retry or verify the same attempt before using COD. ${
                          razorpayPending?.verification
                            ? "Payment verification can be safely retried."
                            : "Restore the original delivery details to retry it."
                        }`}
                  </p>
                )}
                {razorpayPending?.terminal && (
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      razorpayModalOpen ||
                      pendingCod ||
                      Boolean(paymentRecoveryError) ||
                      !paymentRecoveryLoaded ||
                      razorpaySdkStatus !== "ready"
                    }
                    onClick={() => {
                      const form = checkoutFormRef.current;
                      if (!form?.reportValidity()) return;
                      newPaymentAttemptRequestedRef.current = true;
                      form.requestSubmit();
                    }}
                    className="mt-4 border border-gold px-4 py-3 text-[10px] tracking-luxury uppercase text-foreground transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Start new payment attempt
                  </button>
                )}
                {pendingCod && (
                  <p role="status" className="mt-4 text-sm text-amber-700">
                    A COD request is awaiting confirmation. Retry that request before switching
                    payment methods.
                  </p>
                )}
                {pay === "razorpay" && (
                  <p
                    role={razorpaySdkError ? "alert" : "status"}
                    className={`mt-4 text-sm ${razorpaySdkError ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {razorpaySdkError ??
                      (razorpaySdkStatus === "loading"
                        ? "Loading secure Razorpay Checkout..."
                        : razorpaySdkStatus === "ready"
                          ? "Razorpay Checkout is ready. The server will calculate the payable amount."
                          : "Razorpay Checkout is not ready.")}
                  </p>
                )}

                <div className="mt-6 border border-border p-4">
                  <p className="text-sm font-medium">Prepaid cart readiness</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This checks and synchronizes your saved cart only. It does not create an order
                    or start a payment.
                  </p>
                  {!authHydrated ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Checking your sign-in status...
                    </p>
                  ) : user?.role !== "CUSTOMER" ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Sign in with a customer account to prepare a prepaid cart.
                    </p>
                  ) : null}
                  {prepaidSyncError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {prepaidSyncError}
                    </p>
                  )}
                  {prepaidCartReady && (
                    <p className="mt-3 text-sm text-emerald-700">
                      Your saved cart matches your selection. No payment has been started.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void verifyPrepaidCart()}
                    disabled={
                      prepaidSyncing ||
                      !authHydrated ||
                      user?.role !== "CUSTOMER" ||
                      cart.length === 0
                    }
                    className="mt-4 border border-gold px-4 py-3 text-[10px] tracking-luxury uppercase text-foreground transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prepaidSyncing
                      ? "Verifying saved cart..."
                      : prepaidCartReady
                        ? "Verify again"
                        : "Verify prepaid cart"}
                  </button>
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
                      Your saved cart is verified before a Razorpay order is created. Payment is
                      confirmed only after the backend verifies the Razorpay signature.
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
                  razorpayModalOpen ||
                  !paymentRecoveryLoaded ||
                  Boolean(paymentRecoveryError) ||
                  (pay === "cod" &&
                    (!user ||
                      eligibilityLoading ||
                      !codEligibility?.eligible ||
                      razorpayAttemptUnresolved)) ||
                  (pay === "razorpay" &&
                    (user?.role !== "CUSTOMER" ||
                      pendingCod ||
                      Boolean(razorpayPending?.terminal) ||
                      (!razorpayKeyId && !razorpayPending?.verification) ||
                      (razorpaySdkStatus !== "ready" && !razorpayPending?.verification)))
                }
                className="w-full bg-midnight text-frost py-5 text-[11px] tracking-luxury uppercase hover:bg-gold hover:text-midnight transition-colors duration-500 inline-flex items-center justify-center gap-3"
              >
                <Lock className="h-4 w-4" />
                {submitting
                  ? pay === "cod"
                    ? "Submitting Order..."
                    : "Preparing payment..."
                  : submissionUncertain
                    ? "Retry Order Confirmation"
                    : pay === "cod"
                      ? codEligibility?.eligible
                        ? `Place COD Order · ${formatRupees(codEligibility.total)}`
                        : "COD unavailable"
                      : razorpayPending?.verification
                        ? "Retry payment verification"
                        : razorpayPending
                          ? "Retry same payment attempt"
                          : "Pay securely with Razorpay"}
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
                          : "Server-priced"}
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
                    <Row
                      label="Prepaid amount"
                      value={
                        razorpayPending?.order
                          ? formatRupees(razorpayPending.order.amount / 100)
                          : "Calculated securely by server"
                      }
                    />
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gold/30 flex justify-between items-baseline">
                  <span className="text-[11px] tracking-luxury uppercase">Total</span>
                  <span className="font-display text-3xl text-gradient-gold">
                    {pay === "cod"
                      ? codEligibility
                        ? formatRupees(codEligibility.total)
                        : "Checking..."
                      : razorpayPending?.order
                        ? formatRupees(razorpayPending.order.amount / 100)
                        : "Server calculated"}
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
                {placedPaymentMethod === "razorpay"
                  ? `Payment was verified by the server. Order ${placedOrderId ? `#${placedOrderId} ` : ""}has been placed.`
                  : `Order ${placedOrderId ? `#${placedOrderId} ` : ""}has been placed. Payment remains pending collection and is due in cash upon delivery.`}
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
