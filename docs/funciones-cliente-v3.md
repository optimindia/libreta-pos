# Funciones para el negocio — Libreta v3

Esta ampliación está enfocada en quien opera el comercio todos los días, no en
la administración de cuentas de Libreta.

## Pedidos

- Crear pedidos desde mostrador, teléfono o WhatsApp.
- Vincular un cliente existente o crear uno rápidamente.
- Agregar productos, cantidades y precios promocionales vigentes.
- Elegir retiro o envío a domicilio.
- Guardar fecha de entrega, dirección y nota interna.
- Reservar stock sin descontarlo del inventario físico.
- Buscar pedidos por cliente, producto, teléfono o número.
- Filtrar por pendiente, preparando, listo, entregado o cancelado.
- Avanzar el pedido por etapas.
- Compartir la confirmación por WhatsApp.
- Cobrar y convertir un pedido en venta real.
- Liberar automáticamente la reserva al cancelar.

## Clientes

- Cartera separada de fiados.
- Búsqueda por nombre, teléfono o producto frecuente.
- Métricas de recurrencia, ticket medio y gasto acumulado.
- Ficha con últimas compras y productos preferidos.
- Saldo de fiado y días de antigüedad visibles.
- Edición rápida de datos y límite de crédito.
- Contacto directo por WhatsApp.

## Catálogo

- Precio promocional temporal por producto.
- Oferta visible en Vender y copiada al ticket de ese momento.
- Precio habitual histórico protegido.
- La venta respeta reservas activas para evitar sobreventa.

Todo funciona primero en el dispositivo y se sincroniza con el negocio cuando
hay conexión. Las tablas nuevas usan RLS, claves compuestas por negocio e
índices para sus relaciones.
