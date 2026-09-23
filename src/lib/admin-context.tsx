import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type AdminContextValue = {
  selectedStoreSlug: string;
  isParentContext: boolean;
  setSelectedStoreSlug: (slug: string) => void;
};

const DEFAULT_STORE_SLUG = String(import.meta.env.VITE_STORE_SLUG || "haston").trim().toLowerCase();
const AdminContext = createContext<AdminContextValue | null>(null);
let currentAdminStoreSlug = DEFAULT_STORE_SLUG;

export function getAdminStoreSlug() {
  return currentAdminStoreSlug;
}

export function AdminContextProvider({ children }: { children: ReactNode }) {
  const [selectedStoreSlug, setSelectedStoreSlug] = useState(() => {
    currentAdminStoreSlug = DEFAULT_STORE_SLUG;
    return DEFAULT_STORE_SLUG;
  });
  const isParentContext = selectedStoreSlug === "house-of-valerion";
  const updateSelectedStoreSlug = (slug: string) => {
    const normalizedSlug = String(slug).trim().toLowerCase();
    currentAdminStoreSlug = normalizedSlug;
    setSelectedStoreSlug(normalizedSlug);
  };
  const value = useMemo(
    () => ({ selectedStoreSlug, isParentContext, setSelectedStoreSlug: updateSelectedStoreSlug }),
    [selectedStoreSlug, isParentContext]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminContext() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdminContext must be used within AdminContextProvider");
  return context;
}
