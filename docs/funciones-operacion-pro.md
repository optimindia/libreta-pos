# Control Pro: 30 funciones operativas nuevas

La ruta **Control Pro** (`/operacion`) reúne una lectura accionable del negocio. No crea una segunda fuente de verdad: recalcula sobre las ventas, productos, clientes, fiados, pedidos y movimientos que ya guarda Libreta.

## Las 30 funciones

1. **Score operativo:** una puntuación explicable de preparación para vender.
2. **Alertas priorizadas:** stock, fiados, reservas, pedidos, márgenes y cobros sin referencia en una sola bandeja.
3. **Comparativa real:** período actual contra su ventana equivalente.
4. **Horas rentables:** franjas que concentran facturación y ganancia.
5. **Ritmo diario:** serie de siete días para detectar aceleraciones y días flojos.
6. **Pronóstico de siete días:** proyección conservadora con confianza visible.
7. **Meta de venta:** objetivo diario editable, guardado por dispositivo y con progreso.
8. **Mix de cobros:** distribución por efectivo, transferencia, QR y fiado.
9. **Referencias digitales:** detección de transferencias y QR sin referencia.
10. **Cierre inteligente:** efectivo esperado desde el último arqueo, incluyendo movimientos.
11. **Valor de inventario:** capital a costo, valor potencial a precio y margen.
12. **Cobertura de stock:** días estimados por producto con prioridad de agotados.
13. **Radar de rotación:** productos activos, críticos, vigilables o dormidos.
14. **Reposición sugerida:** cantidad orientativa e inversión para comprar.
15. **Guardia de margen:** precios debajo del costo o del margen mínimo.
16. **Salud del catálogo:** códigos, costos, precios, stock y completitud.
17. **Riesgo de reservas:** pedidos que en conjunto comprometen unidades disponibles.
18. **Clientes principales:** ranking por compras, gasto y ticket promedio.
19. **Clientes inactivos:** cartera que dejó de comprar y merece reactivación.
20. **Recurrencia:** proporción de clientes que volvieron a comprar.
21. **Oportunidades:** compradores de una vez o con señales de regreso.
22. **Riesgo de cartera:** semáforo por saldo, antigüedad y límite de fiado.
23. **Vencimientos:** deudas vencidas, próximas, futuras o sin fecha.
24. **Fichas incompletas:** clientes con compras pero sin teléfono.
25. **Pedidos para hoy:** agenda de entregas activas del día.
26. **Pedidos atrasados:** entregas abiertas que ya pasaron de fecha.
27. **Stock comprometido:** unidades y valor bloqueados por reservas activas.
28. **Control de integridad:** duplicados, negativos, fiados sin cliente, pedidos vacíos y pagos excedidos.
29. **Informe portable:** exportación JSON con la foto operativa y sus datos relacionados.
30. **Resumen compartible:** mensaje ejecutivo listo para enviar por WhatsApp.

## Decisiones de producto

- **Local-first:** los cálculos funcionan sin conexión y se actualizan cuando cambia Dexie/IndexedDB.
- **Sin mutaciones peligrosas:** Control Pro es una capa de lectura; sus accesos llevan a Stock, Fiados, Pedidos, Clientes, Plata o Configuración para resolver.
- **Fechas explícitas:** el período se puede cambiar entre Hoy, 7 días y 30 días.
- **Acciones reversibles:** la meta se guarda sólo en el dispositivo; el informe se descarga localmente; compartir abre WhatsApp sin enviar nada automáticamente.
- **Privacidad:** no se agregan credenciales ni servicios externos; la nube sólo se muestra como estado de sincronización existente.

## Verificación

La lógica pura está cubierta en `tests/dominio/operacionPro.test.ts`, junto con las suites existentes de dominio, datos, API, UI y E2E.
