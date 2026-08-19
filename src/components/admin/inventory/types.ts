export type HistoryEntry = {
  id: number;
  type: "create" | "increase" | "decrease" | "adjustment" | "transfer";
  quantity: number;
  note: string;
  timestamp: string;
  warehouse?: string;
};

export type InventoryItem = {
  id: number;
  productId: string;
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  currentStock: number;
  reservedStock: number;
  reorderLevel: number;
  unitCost: number;
  price: number;
  image?: string;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  lastUpdated: string;
  history: HistoryEntry[];
};

export type InventoryDraft = {
  name: string;
  sku: string;
  category: string;
  warehouse: string;
  currentStock: string;
  reservedStock: string;
  reorderLevel: string;
  unitCost: string;
  price: string;
  quantity: string;
  targetWarehouse: string;
  note: string;
};

export type StatusKey = "inStock" | "lowStock" | "outOfStock" | "reserved";
export type SortKey = "name" | "sku" | "warehouse" | "currentStock" | "reservedStock" | "available" | "status" | "lastUpdated";

export type DistributionSegment = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

export type WarehouseDatum = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

export type MovementDatum = {
  month: string;
  added: number;
  sold: number;
  returned: number;
  adjusted: number;
};

export type CategorySegment = {
  name: string;
  value: number;
  color: string;
};

export type TrendDatum = {
  month: string;
  value: number;
};
