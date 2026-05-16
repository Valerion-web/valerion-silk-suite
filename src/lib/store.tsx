import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export type CartItem = { id: string; qty: number; size: string; color: string };
export type WishItem = { id: string };

type Store = {
  cart: CartItem[];
  wishlist: WishItem[];
  cartCount: number;
  wishCount: number;
  addToCart: (item: CartItem, name?: string) => void;
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

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(safeGet<CartItem[]>(CART_KEY, []));
    setWishlist(safeGet<WishItem[]>(WISH_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const addToCart = useCallback((item: CartItem, name?: string) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.id === item.id && c.size === item.size && c.color === item.color);
      if (ex) return prev.map((c) => (c === ex ? { ...c, qty: c.qty + item.qty } : c));
      return [...prev, item];
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
    [cart, wishlist, addToCart, updateQty, removeFromCart, clearCart, toggleWishlist, removeFromWishlist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShop must be used within ShopProvider");
  return ctx;
}
