const PLACEHOLDER_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
    <rect width="1200" height="1600" fill="#f8fafc" />
    <rect x="140" y="140" width="920" height="1280" rx="32" fill="#ffffff" stroke="#e2e8f0" stroke-width="6" />
    <rect x="260" y="360" width="680" height="120" rx="20" fill="#e2e8f0" />
    <rect x="260" y="540" width="520" height="26" rx="13" fill="#cbd5e1" />
    <rect x="260" y="590" width="460" height="26" rx="13" fill="#cbd5e1" />
    <rect x="260" y="640" width="600" height="26" rx="13" fill="#cbd5e1" />
    <rect x="260" y="760" width="300" height="42" rx="21" fill="#d4af37" />
    <text x="600" y="1160" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="#041e42">House of Valerion</text>
  </svg>
`)}`;

export function getProductImage(images?: string[] | string | null): string {
  if (!images) return PLACEHOLDER_IMAGE;

  if (typeof images === "string") {
    return images || PLACEHOLDER_IMAGE;
  }

  const firstImage = images.find(Boolean);
  return firstImage || PLACEHOLDER_IMAGE;
}
