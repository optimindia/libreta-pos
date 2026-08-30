import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel sirve desde la raíz del dominio, así que no hay basePath.
  // Tampoco `output: "export"`: la app necesita servidor para el
  // endpoint que lee la factura por foto (/api/factura).
  images: { unoptimized: true },
};

export default nextConfig;
