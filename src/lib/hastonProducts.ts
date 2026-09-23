import { apiFetch } from "@/lib/api";

export type HASTONVariant = {
  id: number;
  sku?: string;
  size?: string | null;
  color?: string | null;
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

async function getJSON(path: string) {
  const response = await apiFetch(path);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Unable to load products (${response.status})`);
  return body;
}

export async function fetchHASTONProducts(query = "") {
  const body = await getJSON(`/api/products${query}`);
  if (!Array.isArray(body)) throw new Error("Invalid product response");
  return body.map(mapHASTONProduct);
}

export async function fetchHASTONProduct(id: string | number) {
  if (!/^\d+$/.test(String(id))) throw new Error("Product not found");
  return mapHASTONProduct(await getJSON(`/api/products/${id}`));
}
