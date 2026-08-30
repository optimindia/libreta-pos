import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages sirve desde /libreta-pos/, no desde /.
  // basePath le dice a Next: "generá todos los HTML/links/JS
  // asumiendo que la app vive bajo ese prefijo".
  basePath: "/libreta-pos",
  assetPrefix: "/libreta-pos/",
  output: "export",
  // PWA: rutas absolutas romperían bajo basePath — todo relativo
  images: { unoptimized: true },
};

export default nextConfig;