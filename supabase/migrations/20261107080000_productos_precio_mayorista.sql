-- Mejora #8: precio mayorista por producto y desde cuántas unidades se
-- aplica solo. Aditiva.
alter table public.productos add column if not exists precio_mayorista bigint, add column if not exists mayorista_desde numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'productos_mayorista_valido') then
    alter table public.productos add constraint productos_mayorista_valido check ((precio_mayorista is null or precio_mayorista > 0) and (mayorista_desde is null or mayorista_desde > 0));
  end if;
end $$;
grant insert (precio_mayorista, mayorista_desde), update (precio_mayorista, mayorista_desde) on table public.productos to authenticated;

-- El vendedor no toca precios: tampoco el mayorista.
create or replace function private.productos_cuidar_ficha() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.es_dueno(old.negocio_id) then return new; end if;
  if new.id is distinct from old.id or new.negocio_id is distinct from old.negocio_id or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'sólo el dueño puede borrar productos' using errcode = '42501';
  end if;
  new.nombre := old.nombre; new.codigo_barras := old.codigo_barras; new.costo := old.costo; new.precio := old.precio;
  new.stock_minimo := old.stock_minimo; new.precio_oferta := old.precio_oferta; new.oferta_hasta := old.oferta_hasta;
  new.unidad := old.unidad; new.categoria := old.categoria; new.proveedor_id := old.proveedor_id;
  new.historial_precios := old.historial_precios; new.vence_el := old.vence_el;
  new.precio_mayorista := old.precio_mayorista; new.mayorista_desde := old.mayorista_desde;
  if coalesce(pg_catalog.current_setting('libreta.movimiento_stock', true), '') <> 'si' then new.stock := old.stock; end if;
  return new;
end $$;
