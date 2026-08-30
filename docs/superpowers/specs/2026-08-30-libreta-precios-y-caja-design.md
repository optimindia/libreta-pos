# Libreta — precios masivos, vuelto y cierre de caja

**Fecha:** 2026-08-30 · **Estado:** aprobado por Jesús, en implementación
**Se apoya en:** `2026-08-30-libreta-rediseno-design.md` (arquitectura, sincronización, sistema visual)

## Por qué

Investigada la competencia argentina (Cobrando.app, DonKiosco, KioscoSoft, TuKiosco, Selentor),
los dos dolores más gritados por los dueños de almacén que Libreta no cubre son:

1. **Actualizar precios ante inflación**: el mayorista sube y hay que tocar
   cientos de precios a mano, todas las semanas.
2. **Cuadrar la caja**: en papel son 30 minutos y nunca se sabe si faltó guita.
   Es el argumento de venta más repetido del rubro.

## A. Precios masivos

Nueva sección **"Actualizar precios"** dentro de Stock. Dos caminos:

1. **Por porcentaje**: subir (o bajar) todos los precios X%, con vista previa
   `$4.850 → $5.340` antes de aplicar. Se pueden desmarcar productos.
2. **Desde el costo nuevo**: la app ya conoce el costo que vino en la última
   factura (la función foto → factura lo carga). Con un margen elegido
   (por defecto 25%), el precio de venta se recalcula desde el costo real.

Reglas del dominio (`src/dominio/precios.ts`):

- El redondeo es hacia arriba a múltiplos de **$10**: ningún precio termina
  en $3.847. `PASO_REDONDEO = 1000` centavos.
- El cálculo nunca toca productos desmarcados ni escribe sin vista previa:
  el almacenero siempre confirma antes de aplicar (misma regla que la
  foto → factura: la IA nunca escribe directo en el catálogo).
- La actualización usa el repositorio existente de productos: cada precio
  nuevo se encola como `producto/actualizar`, igual que una edición manual.

## B. Vuelto

En la pantalla de cobro, al tocar **Efectivo** aparece "¿con cuánto pagó?".
El vuelto se calcula al instante (`vuelto(entregado, total)` en `dinero.ts`).
Los otros medios cobran directo, como hasta ahora.

## C. Cierre de caja

Botón **"Cerrar caja"** en Plata.

- La app calcula el **efectivo esperado** desde el último cierre:
  `fondo inicial + ventas en efectivo + pagos de fiado`.
  El fondo inicial por defecto es lo contado en el cierre anterior
  (la plata que quedó en el cajón es el fondo de mañana); el primer
  cierre arranca de $0 y el fondo se puede editar antes de cerrar.
- Los pagos de fiado se cuentan como efectivo: en el mostrador se cobran
  en efectivo. Simplificación honesta de v1, documentada acá.
- El almacenero cuenta el cajón, escribe el monto y ve la **diferencia**:
  verde si cuadra, ámbar si falta — "faltó", no "error".
- Cada cierre queda guardado con fecha, esperado, contado y diferencia.
  La historia de cierres es el control de siempre: si todos los martes
  faltan $2.000, ya se sabe qué pasa los martes.
- Al cerrar se ofrece mandar el **resumen del día por WhatsApp**
  (vendido, ganancia, diferencia de caja).

### Datos

- Entidad nueva `Cierre` (`dominio/tipos.ts`): id, fecha, fondoInicial,
  ventasEfectivo, pagosFiadoEfectivo, esperado, contado.
- Tabla local Dexie `cierres` (versión 2 del esquema) y tabla `cierres`
  en Postgres con `negocio_id` e índice `(negocio_id, fecha desc)`.
- El cierre se sincroniza como **inserción con su id local** — se sube el
  hecho, nunca el número. El esperado se recalcula siempre desde las
  ventas; si un cierre sincroniza tarde, no pisa nada.
- RLS igual que el resto: `negocio_id in (select negocios_del_usuario())`.

## Pruebas

TDD en `dominio/` como siempre: `precios.ts` (porcentaje, redondeo, margen,
exclusiones), `vuelto`, y `caja.ts` (esperado, diferencia, límites de
fecha desde el último cierre). Repositorios: alta y listado de cierres.
Recorrido e2e: venta en efectivo → cierre de caja que cuadra.