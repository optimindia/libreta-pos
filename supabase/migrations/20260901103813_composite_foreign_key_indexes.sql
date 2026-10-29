
create index if not exists venta_items_producto_negocio_idx on public.venta_items (producto_id, negocio_id);
create index if not exists ingreso_items_producto_negocio_idx on public.ingreso_items (producto_id, negocio_id);
create index if not exists suscripcion_eventos_suscripcion_negocio_idx on public.suscripcion_eventos (suscripcion_id, negocio_id);
create index if not exists ventas_resumen_producto_negocio_idx on public.ventas_resumen (producto_id, negocio_id);
