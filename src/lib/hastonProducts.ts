import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  products as localProducts,
  type BackendProductVariant,
  type Product,
} from "@/lib/products";

export type HASTONVariant = {
  id: number;
  sku?: string;
  size?: string | null;
  color?: string | null;
  colorCode?: string | null;
  priceOverride?: number | null;
  quantityOnHand?: number;
  status?: string;
};

export type HASTONProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  countInStock: number;
  availability?: string;
  images: string[];
  image: string;
  hoverImage?: string | null;
  altImage?: string;
  category?: { name?: string; slug?: string } | null;
  brand?: { name?: string; slug?: string } | null;
  sizes: string[];
  colors: string[];
  material?: string | null;
  variants: HASTONVariant[];
  rating?: number;
  reviews?: number;
};

export function mapHASTONProduct(product: any): HASTONProduct {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean).map(String) : [];
  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant: any) => ({
        ...variant,
        id: Number(variant.id),
        priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride),
      }))
    : [];
  return {
    id: Number(product.id),
    name: product.name,
    slug: product.slug,
    description: product.description || product.fullDescription || product.shortDescription || "",
    price: Number(product.price || 0),
    countInStock: Number(product.countInStock || 0),
    availability: product.availability,
    images,
    image: product.image || images[0] || "",
    hoverImage: product.hoverImage || images[1] || images[0] || null,
    altImage: product.altImage || images[1] || undefined,
    category: product.category || null,
    brand: product.brand || null,
    sizes: Array.isArray(product.sizes) ? product.sizes : variants.map((variant: HASTONVariant) => variant.size).filter(Boolean),
    colors: Array.isArray(product.colors) ? product.colors : variants.map((variant: HASTONVariant) => variant.color).filter(Boolean),
    material: product.material || null,
    variants,
    rating: typeof product.rating === "number" ? product.rating : undefined,
    reviews: typeof product.reviews === "number" ? product.reviews : undefined,
  };
}

export function mapStorefrontProducts(
  catalog: HASTONProduct[],
  fallbackProducts: Product[] = localProducts,
): Product[] {
  const productsBySlug = new Map<string, HASTONProduct[]>();
  for (const product of catalog) {
    if (!product.slug) continue;
    const matches = productsBySlug.get(product.slug) ?? [];
    matches.push(product);
    productsBySlug.set(product.slug, matches);
  }

  return fallbackProducts.map((fallback) => {
    const matches = productsBySlug.get(fallback.id);
    if (
      matches?.length !== 1 ||
      !Number.isSafeInteger(matches[0].id) ||
      matches[0].id <= 0 ||
      !matches[0].name
    ) {
      return fallback;
    }

    const product = matches[0];
    return {
      ...fallback,
      name: product.name,
      category: product.category?.name || fallback.category,
      price: product.price,
      image: product.image || fallback.image,
      altImage: product.altImage || fallback.altImage,
      colors: product.colors.length ? product.colors : fallback.colors,
      sizes: product.sizes.length ? product.sizes : fallback.sizes,
      fabric: product.material || fallback.fabric,
      description: product.description || fallback.description,
      rating: product.rating ?? fallback.rating,
      reviews: product.reviews ?? fallback.reviews,
      backendProductId: product.id,
      backendVariants: product.variants,
      availability: product.availability,
      countInStock: product.countInStock,
      images: product.images,
    };
  });
}

export function findVerifiedBackendVariant(
  product: Product,
  size?: string,
  color?: string,
): BackendProductVariant | null {
  if (
    !Number.isSafeInteger(product.backendProductId) ||
    Number(product.backendProductId) <= 0 ||
    !size ||
    !color
  ) {
    return null;
  }

  const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";
  const matches = (product.backendVariants ?? []).filter(
    (variant) =>
      variant.status === "ACTIVE" &&
      normalize(variant.size) === normalize(size) &&
      [variant.color, variant.colorCode].some((option) => normalize(option) === normalize(color)),
  );
  if (matches.length !== 1) return null;
  return Number.isSafeInteger(matches[0].id) && matches[0].id > 0 ? matches[0] : null;
}

async function getJSON(path: string, signal?: AbortSignal) {
  const response = await apiFetch(path, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Unable to load products (${response.status})`);
  return body;
}

export async function fetchHASTONProducts(query = "", signal?: AbortSignal) {
  const body = await getJSON(`/api/products${query}`, signal);
  if (!Array.isArray(body)) throw new Error("Invalid product response");
  return body.map(mapHASTONProduct);
}

export async function fetchHASTONProduct(id: string | number) {
  if (!/^\d+$/.test(String(id))) throw new Error("Product not found");
  return mapHASTONProduct(await getJSON(`/api/products/${id}`));
}

export async function fetchStorefrontProducts(signal?: AbortSignal): Promise<Product[]> {
  try {
    return mapStorefrontProducts(await fetchHASTONProducts("", signal));
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      console.error("[Catalog] Unable to load storefront products; using static catalog:", error);
    }
    return localProducts;
  }
}

export function useStorefrontProducts() {
  const [products, setProducts] = useState<Product[]>(localProducts);

  useEffect(() => {
    const controller = new AbortController();
    void fetchStorefrontProducts(controller.signal).then((catalog) => {
      if (!controller.signal.aborted) setProducts(catalog);
    });
    return () => controller.abort();
  }, []);

  return products;
}
