-- Mejora #5: pago dividido. Una venta puede guardar sus partes (medio y
-- monto) en `pagos`; `medio_pago` queda con el medio de la parte más grande.
-- Aditiva: columna nueva, nullable, con su permiso por columna.
alter table public.ventas add column if not exists pagos jsonb;
grant insert (pagos), update (pagos) on table public.ventas to authenticated;
