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

const description =
  "Crafted from the finest Italian wool, this piece embodies the House of Valerion philosophy — quiet confidence, precise construction, and timeless silhouettes engineered for the modern gentleman.";

export const products: Product[] = [
  { id: "valerion-001", name: "Midnight Peak-Lapel Suit", category: "Tailored Suits", price: 2890, image: suits, altImage: formal, badge: "Bestseller", colors: ["#0A1931", "#1E3A8A", "#1f1f1f"], sizes: ["46", "48", "50", "52", "54"], fabric: "Super 150s Italian Wool", description },
  { id: "valerion-002", name: "Atelier Poplin Shirt", category: "Premium Shirts", price: 320, image: shirts, altImage: oversized, badge: "New", colors: ["#F8FAFC", "#0A1931", "#D4AF37"], sizes: ["S", "M", "L", "XL"], fabric: "Egyptian Cotton Poplin", description },
  { id: "valerion-003", name: "Oversized Royal Blazer", category: "Oversized Luxury", price: 1480, image: oversized, altImage: suits, badge: "Limited", colors: ["#0A1931", "#000"], sizes: ["S", "M", "L", "XL"], fabric: "Virgin Wool Twill", description },
  { id: "valerion-004", name: "Three-Piece Royal Suit", category: "Modern Formalwear", price: 3450, image: formal, altImage: suits, colors: ["#1E3A8A", "#0A1931"], sizes: ["46", "48", "50", "52"], fabric: "Loro Piana Wool", description },
  { id: "valerion-005", name: "Cashmere Ribbed Knit", category: "Knitwear Essentials", price: 690, image: knitwear, altImage: shirts, badge: "New", colors: ["#071120", "#F8FAFC", "#D4AF37"], sizes: ["S", "M", "L", "XL"], fabric: "Mongolian Cashmere", description },
  { id: "valerion-006", name: "Hooded Overcoat Noir", category: "Street Luxury", price: 1890, image: street, altImage: oversized, badge: "Bestseller", colors: ["#000", "#0A1931"], sizes: ["S", "M", "L", "XL"], fabric: "Wool & Cashmere Blend", description },
  { id: "valerion-007", name: "Sapphire Tuxedo Jacket", category: "Modern Formalwear", price: 2390, image: formal, altImage: oversized, colors: ["#1E3A8A"], sizes: ["46", "48", "50"], fabric: "Silk Faille", description },
  { id: "valerion-008", name: "Double-Cuff Royal Shirt", category: "Premium Shirts", price: 380, image: shirts, altImage: knitwear, colors: ["#F8FAFC", "#1E3A8A"], sizes: ["S", "M", "L", "XL"], fabric: "Sea Island Cotton", description },
  { id: "valerion-009", name: "Heritage Trousers", category: "Tailored Suits", price: 540, image: suits, altImage: formal, colors: ["#0A1931", "#071120"], sizes: ["46", "48", "50", "52"], fabric: "Italian Wool", description },
  { id: "valerion-010", name: "Roma Cashmere Polo", category: "Knitwear Essentials", price: 480, image: knitwear, altImage: shirts, colors: ["#071120", "#F8FAFC"], sizes: ["S", "M", "L", "XL"], fabric: "Cashmere Silk", description },
  { id: "valerion-011", name: "Oversized Wool Coat", category: "Oversized Luxury", price: 2190, image: oversized, altImage: street, badge: "Limited", colors: ["#0A1931"], sizes: ["S", "M", "L"], fabric: "Double-Faced Cashmere", description },
  { id: "valerion-012", name: "Velour Lounge Hoodie", category: "Street Luxury", price: 590, image: street, altImage: knitwear, colors: ["#000", "#0A1931"], sizes: ["S", "M", "L", "XL"], fabric: "Cotton Velour", description },
  { id: "valerion-013", name: "Royal Sherwani Noir", category: "Ethnic Wear", price: 1980, image: formal, altImage: suits, badge: "Limited", colors: ["#0A1931", "#000"], sizes: ["46", "48", "50", "52"], fabric: "Silk Brocade", description },
  { id: "valerion-014", name: "Bandhgala Heritage Coat", category: "Ethnic Wear", price: 1690, image: suits, altImage: formal, colors: ["#071120", "#1E3A8A"], sizes: ["46", "48", "50"], fabric: "Raw Silk", description },
  { id: "valerion-015", name: "Ivory Kurta Set", category: "Ethnic Wear", price: 890, image: shirts, altImage: knitwear, badge: "New", colors: ["#F8FAFC", "#D4AF37"], sizes: ["S", "M", "L", "XL"], fabric: "Silk Cotton", description },
  { id: "valerion-016", name: "Gold Silk Pocket Square", category: "Accessories", price: 180, image: shirts, altImage: formal, colors: ["#D4AF37", "#F8FAFC"], sizes: ["One Size"], fabric: "Pure Silk", description },
  { id: "valerion-017", name: "Midnight Leather Belt", category: "Accessories", price: 290, image: street, altImage: oversized, colors: ["#000", "#0A1931"], sizes: ["32", "34", "36", "38"], fabric: "Italian Calf Leather", description },
  { id: "valerion-018", name: "Cashmere Bouclé Cardigan", category: "Knitwear Essentials", price: 820, image: knitwear, altImage: oversized, badge: "New", colors: ["#071120", "#C9B99A"], sizes: ["S", "M", "L", "XL"], fabric: "Cashmere Bouclé", description },
];

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

export const findProduct = (id: string) => products.find((p) => p.id === id);
