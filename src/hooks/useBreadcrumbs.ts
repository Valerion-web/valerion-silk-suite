import { useMemo } from "react";
import { useLocation } from "react-router-dom";

export type BreadcrumbItem = {
  label: string;
  path: string;
};

const staticLabels: Record<string, string> = {
  dashboard: "Dashboard",
  products: "Products",
  categories: "Categories",
  brands: "Brands",
  orders: "Orders",
  users: "Customers",
  inventory: "Inventory",
  coupons: "Marketing",
  reports: "Analytics",
  "export-reports": "Reports",
  settings: "Settings",
};

export function useBreadcrumbs() {
  const location = useLocation();

  return useMemo<BreadcrumbItem[]>(() => {
    const pathname = location.pathname.replace(/^\/admin\/?/, "");
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return [{ label: "Dashboard", path: "/admin/dashboard" }];
    }

    return segments.map((segment, index) => {
      const path = `/admin/${segments.slice(0, index + 1).join("/")}`;
      const label = staticLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
      return { label, path };
    });
  }, [location.pathname]);
}
