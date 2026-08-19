import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PageShell } from "@/components/site/PageShell";
import { getProductImage } from "@/lib/image-utils";

type ApiProduct = {
  id: number;
  name: string;
  description: string;
  brand: string;
  price: string | number;
  countInStock: number;
  images: string[];
};

type ShopProduct = {
  id: number;
  name: string;
  description: string;
  brand: string;
  price: number;
  countInStock: number;
  image: string;
  images?: string[];
};

function mapApiProduct(product: ApiProduct): ShopProduct {
  console.log(`🔎 [Shop.mapApiProduct] product.images for id=${product.id}:`, product.images);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    brand: product.brand || "House of Valerion",
    price: typeof product.price === "string" ? Number(product.price) : product.price,
    countInStock: product.countInStock,
    image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : getProductImage(product.images),
    images: product.images,
  };
}

function ShopPage() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        // Determine API URL based on environment
        const apiUrl = import.meta.env.DEV 
          ? "/api/products"  // Use Vite proxy in dev
          : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/products`;
        
        console.log("🔌 [Shop] Fetching products from:", apiUrl);
        console.log("🔌 [Shop] Environment:", import.meta.env.MODE);
        console.log("🔌 [Shop] Dev mode:", import.meta.env.DEV);
        
        const response = await fetch(apiUrl);
        
        console.log("🔌 [Shop] API Response Status:", response.status, response.statusText);
        console.log("🔌 [Shop] Response Headers:", {
          contentType: response.headers.get('content-type'),
          corsHeaders: response.headers.get('access-control-allow-origin'),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("🔌 [Shop] Error Response Body:", errorText);
          throw new Error(`Failed to load products: ${response.statusText} (${response.status})`);
        }

        const apiProducts: ApiProduct[] = await response.json();
        
          console.log("✅ [Shop] API Response Data:", apiProducts);
        
        if (!Array.isArray(apiProducts)) {
          throw new Error("Invalid API response format - expected array");
        }

        if (apiProducts.length === 0) {
          console.warn("⚠️  [Shop] API returned no products - check database seeding");
        }

        const mappedProducts = apiProducts.map(mapApiProduct);
          console.log("✅ [Shop] Mapped products:", mappedProducts);
        
        // Log products with missing images
        const productsWithoutImages = mappedProducts.filter(p => !p.images || p.images.length === 0);
        if (productsWithoutImages.length > 0) {
          console.warn(`⚠️  [Shop] ${productsWithoutImages.length} products without images:`, productsWithoutImages);
        }

        setProducts(mappedProducts);
        console.log("✅ [Shop] Successfully loaded", mappedProducts.length, "products");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("❌ [Shop] Error fetching products:", errorMessage, err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleImageError = (productId: number) => {
    console.warn(`Image failed to load for product ${productId}`);
    setImageErrors(prev => new Set(prev).add(productId));
  };

  return (
    <>
      <PageHeader
        eyebrow="The Edit"
        title="Shop the Collection"
        subtitle="Every piece, considered. Every fabric, exceptional."
      />

      <PageShell className="pt-0">
        <div className="mx-auto max-w-[1500px] px-6 lg:px-12 mt-12">
          {loading ? (
            <div className="rounded-[32px] border border-border bg-background px-8 py-20 text-center text-lg text-muted-foreground">
              Loading products…
            </div>
          ) : error ? (
            <div className="rounded-[32px] border border-red-300 bg-red-50 px-8 py-20 text-center text-lg text-red-700">
              {error}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[32px] border border-border bg-background px-8 py-20 text-center text-lg text-muted-foreground">
              No products available.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <Link key={product.id} to={`/product/${product.id}`} className="rounded-[32px] border border-border bg-background overflow-hidden shadow-card hover:shadow-lg hover:border-gold/50 transition-all duration-300 group">
                  <div className="aspect-[4/5] bg-slate-100 overflow-hidden">
                    {imageErrors.has(product.id) ? (
                      <div className="h-full w-full flex items-center justify-center bg-slate-200 text-muted-foreground text-sm">
                        <span>Image unavailable</span>
                      </div>
                    ) : (
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                        onError={() => handleImageError(product.id)}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] tracking-luxury uppercase text-muted-foreground">{product.brand}</p>
                      <p className={`text-[10px] tracking-luxury uppercase ${product.countInStock > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {product.countInStock > 0 ? "In stock" : "Out of stock"}
                      </p>
                    </div>
                    <h2 className="mt-3 font-display text-xl leading-tight hover:text-gold transition-colors">{product.name}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {product.description}
                    </p>
                    <div className="mt-6 flex items-center justify-between gap-4 text-lg font-serif">
                      <span>${product.price.toLocaleString()}</span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">#{product.id}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}

export default ShopPage;
