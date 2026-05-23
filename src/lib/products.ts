import { products } from "@/data/products";
import suits from "@/assets/collection-suits.jpg";
import shirts from "@/assets/collection-shirts.jpg";
import oversized from "@/assets/collection-oversized.jpg";
import formal from "@/assets/collection-formal.jpg";
import knitwear from "@/assets/collection-knitwear.jpg";
import street from "@/assets/collection-street.jpg";

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  rating?: number;
  reviews?: number;
  image: string;
  altImage?: string;
  badge?: "New" | "Bestseller" | "Limited";
  colors: string[];
  sizes: string[];
  fabric: string;
  description: string;
};

export const collections = [
  { id: "tailored-suits", title: "Tailored Suits", image: suits, count: 24 },
  { id: "premium-shirts", title: "Premium Shirts", image: shirts, count: 38 },
  { id: "oversized-luxury", title: "Oversized Luxury", image: oversized, count: 17 },
  { id: "modern-formalwear", title: "Modern Formalwear", image: formal, count: 21 },
  { id: "knitwear-essentials", title: "Knitwear Essentials", image: knitwear, count: 19 },
  { id: "street-luxury", title: "Street Luxury", image: street, count: 26 },
];

export { products };

export const categories = [
  "All",
  "Tailored Suits",
  "Premium Shirts",
  "Oversized Luxury",
  "Modern Formalwear",
  "Knitwear Essentials",
  "Street Luxury",
  "Ethnic Wear",
  "Accessories",
];

export const sizes = ["S", "M", "L", "XL", "46", "48", "50", "52", "54"];
export const productColors = [
  { name: "Midnight", hex: "#071120" },
  { name: "Navy", hex: "#0A1931" },
  { name: "Royal", hex: "#1E3A8A" },
  { name: "Frost", hex: "#F8FAFC" },
  { name: "Gold", hex: "#D4AF37" },
];

export const slugifyCategory = (category: string) =>
  category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const getCategoryBySlug = (slug: string) =>
  categories.filter((category) => category !== "All").find((category) => slugifyCategory(category) === slug) ?? null;

export const getProductsByCategorySlug = (slug: string) => {
  const category = getCategoryBySlug(slug);
  return category ? products.filter((product) => product.category === category) : [];
};

export const findProduct = (id: string) => products.find((p) => p.id === id);
