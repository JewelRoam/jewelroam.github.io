const mediaBaseUrl = (import.meta.env.VITE_MEDIA_BASE_URL || "https://images.zer.dpdns.org").replace(/\/$/, "");

export const imageWidths = [640, 1280, 2048] as const;

/** Builds Cloudflare Image Transformations URLs without leaking provider details into components. */
export function transformImageUrl(path: string, width: number) {
  const cleanPath = path.replace(/^\//, "");
  return `${mediaBaseUrl}/cdn-cgi/image/width=${width},format=auto,quality=82/${cleanPath}`;
}

export function imageSrcSet(path: string) {
  return imageWidths.map((width) => `${transformImageUrl(path, width)} ${width}w`).join(", ");
}

export function imageFallbackUrl(path: string) {
  const cleanPath = path.replace(/^\//, "");
  return `${mediaBaseUrl}/${cleanPath}`;
}
