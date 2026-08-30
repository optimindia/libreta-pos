# 📒 Libreta — POS para almacenes de barrio

> La libreta de fiado del almacén, pero en el celu: escaneás, vendés, anotás el fiado — y te dice cuánto ganaste hoy.

**Stack:** Next.js 16 (PWA) · Dexie/IndexedDB (offline-first) · BarcodeDetector + zxing · Tailwind 4

## Features MVP
- 📷 Escáner de código de barras (cámara trasera, 2 capas: nativa + zxing)
- 🛒 Venta en 3 toques (escaneás → ticket → cobrás)
- ✍️ Fiado: quién te debe, cuánto y desde cuándo — con cobros parciales
- 📊 Stats: vendido, **ganancia estimada**, top productos, medios de pago
- 📴 Offline-first: todo vive en IndexedDB, funciona sin internet

## Desarrollo
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # verificación de tipos + build producción
```

## Roadmap
Ver [SPEC.md](./SPEC.md) — capas IA (reposición, cobrador de fiado, foto→stock) en semanas 4-8.
