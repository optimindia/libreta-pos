# 📱 LIBRETA — POS para almacenes de barrio (spec v1)

**Fecha:** 2026-08-30 · **Estado:** concepto aprobado por Jesús, listo para MVP
**Nombre tentativo:** Libreta (alternativas: Casero, AlmacénYa) — a definir

---

## 1. El pitch (una línea)

> **La libreta de fiado del almacén, pero en el celu: escaneás, vendés, anotás el fiado — y te dice cuánto ganaste hoy.**

El almacenero argentino no sabe cuánto ganó hoy. Sabe cuánto vendió (MP le dice), pero no su ganancia real, no sabe cuánto le deben, y descubre el faltante de stock cuando el cliente le pide algo que ya no tiene. Eso es el dolor.

## 2. Por qué este hueco existe (análisis de competencia verificado 29/08)

- **Mercado Pago / bancos**: regalan el COBRO (QR), no la gestión. No compiten acá.
- **Alegra POS** (líder): nube-first, en USD, pensado para comercios medianos. Se muere sin internet, caro con el dólar, y el fiado es secundario. **No sirve para el almacén de barrio.**
- **Apps sueltas de inventario**: viejas, en inglés, traps de suscripción.
- **Chile ya validó el modelo**: Almacenes Digitales (4.500+ negocios desde 2020, del cuaderno de fiado a digital). **En Argentina nadie lo hizo grande. Hueco real.**

## 3. Diferencial defensible (por qué no te lo copia Alegra mañana)

1. **Offline-first REAL**: el almacén tiene internet de mierda. IndexedDB como fuente de verdad, sync a la nube cuando hay señal. Los SaaS cloud-first estructuralmente no pueden seguirte acá sin reescribirse.
2. **Fiado como feature #1**, no un módulo olvidado: cliente, monto, fecha, aviso de cobro, historial de quién paga y quién te está llenando.
3. **Español rioplatense, pesos, MP nativo** — cero fricción cultural.
4. **Precio local** (ARS, indexado) vs USD de Alegra.
5. **Switching cost**: el historial de fiado + inventario cargado ES el lock-in. Nadie migra después de 3 meses de datos.

## 4. Features

### MVP (semanas 1-3) — "vender y saber"
- **PWA instalable** (manifiesto + service worker) — ícono en el celu, abre full-screen, funciona sin internet
- **Catálogo con escáner de código de barras** (cámara del celu; BarcodeDetector API nativo en Android + fallback zxing-wasm)
- **Venta en 3 toques**: escaneás → suma al ticket → total → medio de pago (efectivo / transferencia / QR / **fiado**)
- **FIADO**: cliente + monto + vencimiento, lista de deudores con antigüedad
- **Estadísticas simples**: venta del día / mes, top productos, **ganancia estimada** (costo vs precio por unidad)
- **Setup en 5 minutos**: escaneás tus 10 productos más vendidos y ya estás operativo

### La capa IA (semanas 4-8) — "el poco de inteligencia" 🔥
1. **Predicción de reposición**: media móvil de ventas por producto → "te quedan 3 yerbas, se te acaban el viernes" → **lista de compra al proveedor lista para WhatsApp** (estadística pura, cero costo de LLM)
2. **Cobrador de fiado**: avisa deudores viejos + mensaje de cobro ya redactado, listo para reenviar
3. **"¿Cuánto gané hoy?"**: reporte diario en lenguaje natural por WhatsApp al dueño (template o LLM barato)
4. **Foto → stock**: foto de la factura del mayorista → visión IA extrae productos y precios → inventario actualizado solo (LA demo para los ads)
5. **Radar de productos muertos**: "la gaseosa X no gira hace 3 semanas — bajale el precio o cambiala de lugar"

### Fase 2 (mes 2+) 
- Historial por cliente (quién compra qué, cada cuánto)
- Multi-dispositivo (empleado escanea, dueño ve stats)
- Comparación mes vs mes con la inflación real (ganancia en términos reales)

## 5. Arquitectura (stack que YA domina Jesús)

```
Next.js 16 (PWA) + Vercel     ← mismo stack de panel-gestion-pro
Supabase (Postgres + RLS)     ← tablas abajo
IndexedDB (Dexie)             ← fuente de verdad offline, sync cuando hay red
BarcodeDetector + zxing-wasm  ← escáner
Auth: teléfono + PIN          ← el almacenero no banca email/password
```

**Tablas core:**
- `products` (barcode, name, cost_price, sale_price, stock, min_stock)
- `sales` (ts, total, payment_method, items jsonb)
- `customers` (name, phone)
- `credits` (customer_id, amount, created_at, due_date, status)  ← EL fiado
- `credit_payments` (credit_id, amount, ts)
- `inventory_movements` (entrada por factura, salida por venta)

**Sync offline:** IndexedDB manda → cola de sincronización → Supabase cuando hay señal. MVP es single-user por tienda (sin conflictos de escritura concurrente).

## 6. Monetización

- **Gratis**: 50 productos, 1 usuario, venta + fiado básico (el hook "¿quién regala un POS?" — la respuesta: NADIE regala uno que funcione offline y con fiado)
- **Pro: ARS 5.999/mes** (indexado trimestral por inflación): ilimitado, capa IA completa, reportes WhatsApp, multi-dispositivo
- **Ancla psicológica**: "menos de lo que perdés con UN fiado que no cobrás"
- **Canal revendedores** (el playbook IPTV): revendedor de zona que captura y cobra → 30% recurrente. Los revendedores IPTV ya en la red de Jesús conocen 50 negocios cada uno.

## 7. Venta — el funnel Meta ads (canal elegido por Jesús)

Por qué SÍ funciona acá: el almacenero argentino (40-60 años) vive en Facebook y cierra por WhatsApp. Es el mismo funnel que usan financieras y apps del segmento.

- **Creative 15 seg (video demo)**: cámara escaneando la yerba → ticket → "hoy vendiste $187.400, ganaste $38.000" → alerta de fiado → "Tu almacén, en tu celu"
- **Targeting**: Mendoza + 10km (Godoy Cruz, Guaymallén, Las Heras), 30-58, intereses dueño de negocio / emprendedor
- **CTA: WhatsApp, NO download** — se cierra charlando (Jesús VENDE por WhatsApp todos los días, es su fuerte)
- **Piloto: ARS 30.000 / 2 semanas** → meta: 100 conversaciones → 20 activos → 8 pagos

**Unit economics:**
- 100 pagantes = ~$600k ARS/mes · 200 = $1.2M/mes
- Costos fijos: ~$50k (Supabase pro + Vercel) + ads
- **Break-even: ~40 pagantes**

## 8. Roadmap 90 días

- **Semana 1**: nombre + repo + MVP core (catálogo, escáner, venta, fiado) — Jesús codea con IA, Kimi hace arquitectura/review/deploys
- **Semana 2**: stats + PWA install + reporte WhatsApp
- **Semana 3**: **beta gratis con 5 almacenes de su red** (clientes IPTV del barrio = early adopters perfectos). Esto ES la validación, en paralelo, sin frenar el build
- **Semana 4**: iterar feedback real + predicción de reposición
- **Semanas 5-6**: 3 creativos de video + landing + flujo WhatsApp Business
- **Semanas 7-8**: piloto ads $30k — medir CAC real
- **Semana 9: GO/NO-GO con datos**: conversión lead→pago ≥8% · CAC < 2 meses de suscripción · retención 80% a 60 días

## 9. Riesgos y mitigación

- **Soporte B2B** → WhatsApp Business + respuestas IA automáticas para lo repetitivo
- **Inflación** → precio indexado trimestral
- **Alegra baja de precio** → el foso es offline + fiado + local, no el precio
- **Deserción beta** → que carguen su inventario real el día 1 (lock-in desde el inicio)

## 10. División de trabajo

- **Jesús**: producto (codea con IA), ventas por WhatsApp, relación con almacenes beta
- **Kimi**: spec técnica, review de código, deploys, creativos de ads, funnel, métricas GO/NO-GO, y sostenerte el foco los 90 días (parking lot para ideas nuevas)