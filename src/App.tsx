import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { ShopProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

// Import pages
import Index from "@/routes/index";
import About from "@/routes/about";
import Shop from "@/routes/shop";
import Category from "@/routes/category";
import CategorySlug from "@/routes/category.$slug";
import Product from "@/routes/product.$productId";
import Cart from "@/routes/cart";
import Checkout from "@/routes/checkout";
import TrackOrder from "@/routes/track-order";
import Wishlist from "@/routes/wishlist";
import Contact from "@/routes/contact";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ShopProvider>
          <BrowserRouter>
            <ScrollToTop />
            <div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
              <Navbar />
              <div className="flex-1 w-full">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/category" element={<Category />}>
                    <Route path=":slug" element={<CategorySlug />} />
                  </Route>
                  <Route path="/collection" element={<Category />}>
                    <Route path=":slug" element={<CategorySlug />} />
                  </Route>
                  <Route path="/product/:productId" element={<Product />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/track-order" element={<TrackOrder />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="*" element={<NotFoundComponent />} />
                </Routes>
              </div>
              <Footer />
            </div>
            <Toaster
              position="top-center"
              theme="dark"
              toastOptions={{
                classNames: {
                  toast:
                    "luxury-toast !bg-midnight !text-frost !border !border-gold/40 !shadow-[0_0_40px_rgba(212,175,55,0.35)] !rounded-none !px-6 !py-4 !font-serif",
                  title: "!text-frost !tracking-[0.18em] !text-[11px] !uppercase !font-sans",
                  description: "!text-frost/70 !font-serif !italic !text-sm",
                  icon: "!text-gold",
                },
              }}
            />
          </BrowserRouter>
        </ShopProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
