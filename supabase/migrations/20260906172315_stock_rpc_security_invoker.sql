-- La función se ejecuta con los permisos y RLS del usuario autenticado: no
-- eleva privilegios y mantiene el aislamiento del negocio en cada llamada.
alter function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) security invoker;

drop policy if exists registrar_movimientos_stock_del_negocio on public.movimientos_stock;
create policy registrar_movimientos_stock_del_negocio
  on public.movimientos_stock for insert to authenticated
  with check (negocio_id in (select private.negocios_con_acceso()));
grant insert on table public.movimientos_stock to authenticated;
