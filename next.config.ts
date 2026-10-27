import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel sirve desde la raíz del dominio, así que no hay basePath.
  // Tampoco `output: "export"`: la app necesita servidor para el
  // endpoint que lee la factura por foto (/api/factura).
  images: { unoptimized: true },
  async headers() {
    const desarrollo = process.env.NODE_ENV !== 'production'
    const politicaContenido = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ')

    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: politicaContenido },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ],
    }]
  },
};

export default nextConfig;
