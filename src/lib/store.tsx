import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type CartItem = {
  id: string;
  qty: number;
  size: string;
  color: string;
  backendProductId?: number;
  backendVariantId?: number | null;
  backendIdentity: "verified" | "unresolved";
};
export type CartItemInput = Omit<CartItem, "backendIdentity"> & {
  backendIdentity?: CartItem["backendIdentity"];
};
export type WishItem = { id: string };

type Store = {
  cart: CartItem[];
  wishlist: WishItem[];
  cartCount: number;
  wishCount: number;
  addToCart: (item: CartItemInput, name?: string) => void;
  updateQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  toggleWishlist: (id: string, name?: string) => void;
  inWishlist: (id: string) => boolean;
  removeFromWishlist: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

const CART_KEY = "valerion.cart";
const WISH_KEY = "valerion.wishlist";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

const normalizeCartItemIdentity = (item: CartItemInput): CartItem => {
  const hasValidBackendIdentity =
    item.backendIdentity === "verified" &&
    Number.isSafeInteger(item.backendProductId) &&
    Number(item.backendProductId) > 0 &&
    Object.prototype.hasOwnProperty.call(item, "backendVariantId") &&
    (item.backendVariantId == null ||
      (Number.isSafeInteger(item.backendVariantId) && item.backendVariantId > 0));

  if (!hasValidBackendIdentity) {
    return {
      ...item,
      backendProductId: undefined,
      backendVariantId: undefined,
      backendIdentity: "unresolved",
    };
  }

  return { ...item, backendIdentity: "verified" };
};

const normalizePersistedCart = (value: unknown): CartItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is CartItemInput =>
      Boolean(
        item &&
        typeof item === "object" &&
        "id" in item &&
        typeof item.id === "string" &&
        "qty" in item &&
        typeof item.qty === "number" &&
        "size" in item &&
        typeof item.size === "string" &&
        "color" in item &&
        typeof item.color === "string",
      ),
    )
    .map(normalizeCartItemIdentity);
};

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(normalizePersistedCart(safeGet<unknown>(CART_KEY, [])));
    setWishlist(safeGet<WishItem[]>(WISH_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const addToCart = useCallback((item: CartItemInput, name?: string) => {
    const normalizedItem = normalizeCartItemIdentity(item);
    setCart((prev) => {
      const ex = prev.find(
        (c) => c.id === item.id && c.size === item.size && c.color === item.color,
      );
      if (ex) {
        const conflictingIdentity =
          ex.backendIdentity === "verified" &&
          normalizedItem.backendIdentity === "verified" &&
          (ex.backendProductId !== normalizedItem.backendProductId ||
            ex.backendVariantId !== normalizedItem.backendVariantId);
        const identity = conflictingIdentity
          ? {
              backendProductId: undefined,
              backendVariantId: undefined,
              backendIdentity: "unresolved" as const,
            }
          : ex.backendIdentity === "verified"
            ? {
                backendProductId: ex.backendProductId,
                backendVariantId: ex.backendVariantId,
                backendIdentity: "verified" as const,
              }
            : {
                backendProductId: normalizedItem.backendProductId,
                backendVariantId: normalizedItem.backendVariantId,
                backendIdentity: normalizedItem.backendIdentity,
              };
        return prev.map((c) => (c === ex ? { ...c, ...identity, qty: c.qty + item.qty } : c));
      }
      return [...prev, normalizedItem];
    });
    toast.success("Added to Bag", {
      description: name ?? "Your selection has been added.",
      className: "luxury-toast",
    });
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, qty: Math.max(1, qty) } : c)));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((id: string, name?: string) => {
    setWishlist((prev) => {
      if (prev.some((w) => w.id === id)) {
        toast("Removed from Wishlist", { className: "luxury-toast" });
        return prev.filter((w) => w.id !== id);
      }
      toast.success("Added to Wishlist", {
        description: name ?? "Saved to your wishlist.",
        className: "luxury-toast",
      });
      return [...prev, { id }];
    });
  }, []);

  const removeFromWishlist = useCallback((id: string) => {
    setWishlist((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const value = useMemo<Store>(
    () => ({
      cart,
      wishlist,
      cartCount: cart.reduce((s, c) => s + c.qty, 0),
      wishCount: wishlist.length,
      addToCart,
      updateQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      inWishlist: (id: string) => wishlist.some((w) => w.id === id),
      removeFromWishlist,
    }),
    [
      cart,
      wishlist,
      addToCart,
      updateQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      removeFromWishlist,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
