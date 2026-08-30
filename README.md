# Libreta — POS para almacenes de barrio

> La libreta de fiado del almacén, pero en el celu: escaneás, vendés, anotás el fiado — y te dice cuánto ganaste hoy.

**Stack:** Next.js 16 (PWA) · Dexie/IndexedDB (offline-first) · Tailwind 4 · Supabase (opcional) · Vercel

## Qué hace

- **Vender** en tres toques: escaneás o tocás el producto, cobrás por efectivo, transferencia, QR o fiado.
- **Fiado** como ciudadano de primera: quién te debe, desde cuándo, pagos parciales y el mensaje de cobro listo para WhatsApp.
- **Stock** con aviso de faltantes, y carga desde la foto de la factura del mayorista.
- **Plata**: vendido y ganancia del día, medios de pago y qué reponer esta semana.
- **Sin internet**: todo se guarda en el teléfono y sube solo cuando vuelve la señal.

## Cómo está armado

```
src/dominio/   funciones puras que calculan plata (sin base, sin red, sin React)
src/datos/     local: Dexie + cola de sincronización · nube: Supabase (apagada sin credenciales)
src/ui/        sistema visual y las cuatro secciones
src/app/       rutas, manifiesto PWA y el endpoint de la factura
```

La regla que sostiene todo: **`dominio/` no importa nada de `datos/` ni de `ui/`**. Por eso lo que calcula plata se prueba sin navegador y sin base.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 134 pruebas: dominio, datos y pantallas
npm run test:e2e     # recorrido completo, incluido el modo avión
npm run build        # verificación de tipos + build de producción
```

## Documentos

- [Diseño](docs/superpowers/specs/2026-08-30-libreta-rediseno-design.md) — decisiones y el porqué de cada una
- [Plan de implementación](docs/superpowers/plans/2026-08-30-libreta-v2.md)
- [Encender la nube](docs/nube.md) — Supabase paso a paso

## En producción

**https://libreta-sepia.vercel.app**

Desplegado en Vercel (proyecto `libreta`) contra el proyecto de Supabase `Libreta`.
Para publicar cambios: `npm run deploy` (necesita `vercel login` o un token).
Las variables `NEXT_PUBLIC_SUPABASE_*` ya están cargadas en el proyecto de Vercel;
como Next las incrusta durante el build, cambiarlas obliga a desplegar de nuevo.

## Estado

La aplicación funciona completa: offline en el teléfono y sincronizando a Supabase
cuando hay señal, con el aislamiento entre negocios verificado
(`npm run verificar:aislamiento`).

Falta sólo la lectura de facturas por foto, que necesita `ANTHROPIC_API_KEY`
cargada en Vercel.
