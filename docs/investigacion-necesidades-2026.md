# Investigación de necesidades reales — Libreta

**Fecha:** 31 de agosto de 2026  
**Segmento:** almacenes, autoservicios y comercios minoristas pequeños de Argentina.

## Qué está pasando en el negocio real

- El Radar PyME de ENAC para el primer trimestre de 2026 reportó caída de
  ventas en 49,7% de las empresas, aumento de costos en 89,5% y rentabilidad
  negativa en 36,6%. Además, 53% informó más incumplimientos de pago y casi 3
  de cada 10 registró incobrables.
  [Fuente: ENAC](https://enac.org.ar/contenido/4641/encuesta-radar-pyme-1t-2026-caen-las-ventas-aumenta-el-pesimismo-y-se-frena-la-i)
- El BCRA registró en 2025 un promedio de 30 pagos electrónicos mensuales por
  adulto; las transferencias y pagos inmediatos explicaron 6 de cada 10 pagos
  electrónicos. También observó mayor participación de medios electrónicos en
  supermercados y autoservicios mayoristas, mientras el efectivo sigue siendo
  relevante en monto.
  [Fuente: BCRA — Inclusión Financiera 2S 2025](https://www.bcra.gob.ar/publicaciones/informe-de-inclusion-financiera-segundo-semestre-de-2025/)
- ARCA ofrece facturación desde celular, tablet o computadora y señala que los
  monotributistas deben emitir factura electrónica a consumidores finales.
  Esto convierte la facturación en una oportunidad de integración, pero no se
  debe prometer una emisión real sin credenciales, punto de venta y conexión.
  [Fuente: ARCA — Monotributo y facturación](https://arca.gob.ar/facturacion/monotributo/comprobantes.asp)
- Mercado Pago documenta QR estático, dinámico e híbrido, con notificaciones y
  conciliación automática. Para usarlo hacen falta una aplicación, una cuenta
  de vendedor y un Access Token gestionado en backend.
  [Fuente: Mercado Pago — Código QR](https://www.mercadopago.com.ar/developers/es/docs/qr-code/overview)

## Traducción a problemas de producto

| Necesidad | Riesgo si no se resuelve | Respuesta de Libreta |
| --- | --- | --- |
| Margen apretado y costos cambiantes | Vender sin ganar o perder dinero | Costo/precio visibles, alertas de margen, actualización masiva y reposición calculada |
| Cobros digitales masivos | Registrar como cobrado un pago que no se acreditó | Confirmación explícita de transferencia/QR y referencia opcional; integración oficial queda preparada, no simulada |
| Incumplimiento y fiado | Capital inmovilizado e incobrables | Vencimientos, límites, semáforo, mensajes y pagos parciales |
| Errores, devoluciones y diferencias de caja | Stock y reportes falsos | Anulación auditable, motivo, devolución de stock y salida de efectivo |
| Varios aparatos o mala conectividad | Operación detenida o datos distintos | Offline-first, cola, bajada incremental y movimientos de caja sincronizados |
| Obligaciones de facturación | Trabajo duplicado y riesgo de incumplimiento | Próxima integración ARCA con credenciales y contingencia explícita |

## Qué se implementó en esta ampliación

1. Centro de control en **Plata** con prioridades accionables: agotados,
   reposición, margen, fiados vencidos, cierre pendiente y sincronización.
2. Venta auditable: se conserva el registro, se puede anular con motivo, se
   restaura el stock y se registra la devolución en efectivo.
3. Protección del fiado: no se puede anular automáticamente una venta a cuenta
   que ya recibió pagos.
4. Cobro seguro: transferencia y QR exigen confirmar que el pago fue aprobado;
   la referencia queda guardada en la venta.
5. Movimientos de caja sincronizables, con migración SQL, RLS, realtime y
   respaldo local.

## Próximas prioridades, en orden

### P0 — Integración real de pagos y facturación

Conectar Mercado Pago Orders/QR y ARCA sólo cuando estén disponibles las
credenciales del comercio, secretos de backend, punto de venta y ambiente de
prueba. La venta debe quedar pendiente hasta recibir un estado acreditado y
debe existir una ruta clara de contingencia.

### P1 — Compras y proveedores

Agregar proveedor como entidad, historial de costo, deuda con proveedor,
vencimiento y pedido sugerido. El ingreso de mercadería ya existe; falta
convertirlo en control de capital de trabajo.

### P1 — Pedidos y reservas

Permitir guardar un pedido de cliente sin cobrar, reservar stock opcionalmente,
marcarlo listo/entregado y compartirlo por WhatsApp. Esto evita perder ventas
que llegan por mensaje o teléfono.

### P2 — Equipo y control

Agregar perfiles de empleado, PIN por operador, permisos, turno y auditoría de
quién anuló, ajustó stock o abrió/cerró caja. Es el siguiente paso cuando haya
más de un usuario real por negocio.

