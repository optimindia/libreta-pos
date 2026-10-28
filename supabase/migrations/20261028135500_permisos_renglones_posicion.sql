-- Arreglo: la migración 20261028120000 (posición estable de renglones) agregó
-- la columna `posicion` y la sincronización empezó a subirla con upsert y a
-- borrar los renglones sobrantes, pero `authenticated` no tenía INSERT/UPDATE
-- sobre `posicion` en venta_items e ingreso_items ni DELETE en ninguna de las
-- tres tablas de renglones: la subida de renglones fallaba con 42501.
-- Las políticas RLS (por negocio y suscripción) siguen siendo las mismas.
grant insert (posicion), update (posicion) on table public.venta_items to authenticated;
grant insert (posicion), update (posicion) on table public.ingreso_items to authenticated;
grant insert (posicion), update (posicion) on table public.pedido_items to authenticated;
grant delete on table public.venta_items, public.ingreso_items, public.pedido_items to authenticated;

-- Para revertir:
-- revoke delete on table public.venta_items, public.ingreso_items, public.pedido_items from authenticated;
-- revoke insert (posicion), update (posicion) on table public.venta_items, public.ingreso_items from authenticated;
