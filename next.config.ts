import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      // Security headers for all routes.
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          // Microphone allowed (voice examiner). Camera denied.
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // Scripts: self + inline for Next.js hydration + eval for dev (removed in prod by Next.js)
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            // Styles: self + inline (Tailwind, component styles)
            "style-src 'self' 'unsafe-inline'",
            // Images: self + data URIs + tile providers + blob
            "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://api.maptiler.com",
            // Fonts: self + Google Fonts
            "font-src 'self' https://fonts.gstatic.com",
            // Connect: self + Supabase + tile providers + MapTiler + AI (any external base URL)
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://api.maptiler.com https://nominatim.openstreetmap.org https://demotiles.maplibre.org",
            // Workers: self + blob (MapLibre GL workers)
            "worker-src 'self' blob:",
            // Child/frame: none
            "frame-src 'none'",
            // Object: none
            "object-src 'none'",
            // Base URI: self
            "base-uri 'self'",
            // Form actions: self
            "form-action 'self'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;

