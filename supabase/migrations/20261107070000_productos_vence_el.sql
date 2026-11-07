-- Mejora #15: fecha de vencimiento del producto (la más próxima). Aditiva.
alter table public.productos add column if not exists vence_el timestamptz;
grant insert (vence_el), update (vence_el) on table public.productos to authenticated;

-- El vendedor no toca la ficha: tampoco el vencimiento.
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
  if coalesce(pg_catalog.current_setting('libreta.movimiento_stock', true), '') <> 'si' then new.stock := old.stock; end if;
  return new;
end $$;
