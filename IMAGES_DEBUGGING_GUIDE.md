# Image Rendering Issues - Diagnostic & Fix Guide

## Problem Summary
Some product cards on the Shop page show blank/missing images.

## Root Causes

### 1. **Database Not Seeded** (Most Common)
The database may not have been populated with the seed data that includes image URLs.

### 2. **Empty Images Array**
Products might exist in the database but without image URLs in the `images` field.

### 3. **CORS/Network Issues**
External image URLs (Unsplash) might be blocked or unavailable.

---

## Diagnostic Steps

### Step 1: Check Backend Database
Run the database debug utility:
```bash
cd backend
node debug-db.js
```

This will show:
- ✓ Database connection status
- ✓ Total products in database
- ✓ How many products have images
- ⚠️ Which products are missing images

### Step 2: Check API Response
Open your browser and visit:
```
http://localhost:5000/api/products
```

Look for:
- `images` array in each product
- Check if array is empty `[]` or has URLs
- Verify URLs are valid (should start with `https://`)

Example of correct response:
```json
{
  "id": 1,
  "name": "Nocturne Peak-Lapel Suit",
  "images": [
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80"
  ]
}
```

### Step 3: Check Browser Console
Open DevTools (F12) → Console tab and run:
```javascript
// Check all images on page
const images = document.querySelectorAll('img');
console.log(`Total images: ${images.length}`);
images.forEach((img, i) => {
  console.log(`[${i}] ${img.src.substring(0, 80)}... - Loaded: ${img.complete && img.naturalHeight > 0}`);
});
```

---

## Solution: Seeding the Database

If products are missing images, run the seed script:

### Option 1: Fresh Database Seed (Recommended)
```bash
cd backend
npm run seed
```

Expected output:
```
Seeding House of Valerion products...
✓ 17 products seeded with images
Seeding completed successfully.
```

### Option 2: Manual Seed (if npm script doesn't work)
```bash
cd backend
node prisma/seed.js
```

### Option 3: Update Specific Product
If only certain products need images:
```bash
# Inside backend folder
node -e "
import prisma from './lib/prisma.js';
const product = await prisma.product.update({
  where: { id: 1 },
  data: {
    images: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80'
    ]
  }
});
console.log('Updated:', product.name);
"
```

---

## Frontend Changes Made

### 1. **Image Utilities** (`src/lib/image-utils.ts`)
- `getProductImage()` - Extracts first image with SVG placeholder fallback
- Handles empty arrays gracefully
- Returns valid image URL or data URL

### 2. **Shop Page** (`src/routes/shop.tsx`)
- Uses `getProductImage()` utility
- Added error tracking for failed image loads
- Shows "Image unavailable" when load fails
- Logs warnings to console if images are missing

### 3. **ProductCard Component** (`src/components/site/ProductCard.tsx`)
- Supports both local products and API data formats
- Added error state and error icon for failed loads
- Handles missing images gracefully

### 4. **Placeholder Image**
Instead of a missing file, now uses an SVG data URL:
```
data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22...
```
This always displays gracefully instead of breaking.

---

## Verification Steps

After seeding the database:

1. **Restart Backend**
   ```bash
   # Stop current server (Ctrl+C)
   npm start
   ```

2. **Clear Frontend Cache**
   ```
   DevTools → Application → Clear site data
   ```

3. **Reload Shop Page**
   ```
   http://localhost:5173/shop
   ```

4. **Check Browser Console**
   - Should NOT see warnings about missing images
   - Images should load without errors

---

## Advanced Debugging

### Browser Console Commands

```javascript
// 1. Check images on page
const imgs = document.querySelectorAll('img');
console.table(Array.from(imgs).map(img => ({
  src: img.src.substring(0, 60),
  loaded: img.complete && img.naturalHeight > 0,
  dimensions: `${img.naturalWidth}x${img.naturalHeight}`
})));

// 2. Test API
fetch('http://localhost:5000/api/products')
  .then(r => r.json())
  .then(data => {
    console.log('Total products:', data.length);
    const withImages = data.filter(p => p.images?.length > 0).length;
    console.log('With images:', withImages);
    console.log('First product images:', data[0]?.images);
  });

// 3. Test external image loading
fetch('https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80')
  .then(r => r.status === 200 ? '✓ External images OK' : '✗ Failed')
  .then(console.log);
```

---

## Common Issues & Solutions

### Issue: "Image unavailable" shows on all products
**Solution:** 
- Database is not seeded
- Run: `cd backend && npm run seed`
- Restart backend server
- Reload page

### Issue: Seed script fails with "DATABASE_URL not set"
**Solution:**
- Check `.env` file exists in backend folder
- Ensure `DATABASE_URL` environment variable is set
- Run: `npm run seed` from backend directory

### Issue: Some products have images but others don't
**Solution:**
- Only new products are seeded
- Delete existing products from database and re-seed
- Or manually update each product via API

### Issue: Images load but are very slow
**Solution:**
- This is normal for Unsplash URLs
- Consider uploading images to local storage
- Update `images` array with local paths instead of URLs

---

## Image Format & Dimensions

Current product images use:
- **Format**: JPEG (via Unsplash)
- **Dimensions**: Responsive, scaled to fit container
- **Aspect Ratio**: 3/4 or 4/5 depending on component
- **Quality**: Auto-optimized by Unsplash

To use local images instead:
```typescript
// In seed.js or product creation:
images: ['/images/product-1.jpg', '/images/product-2.jpg']
```

---

## Need More Help?

1. **Check server logs** - Backend should warn if products lack images
2. **Run debug script** - `node debug-db.js` in backend folder
3. **Check browser DevTools** - Network tab to see if images load
4. **Verify database connection** - Check PostgreSQL is running
5. **Look at seed output** - Re-run seed and check for errors
