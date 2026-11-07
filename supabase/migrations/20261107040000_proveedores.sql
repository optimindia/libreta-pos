-- Mejora #12/#13: proveedores. Quién te vende cada producto, cuándo pasa,
-- cuánto le debés y el pedido armado para mandarle por WhatsApp.
-- Aditiva: tabla nueva (RLS como el resto, escritura sólo del dueño) y la
-- columna productos.proveedor_id. Borrar un proveedor es marcarlo
-- (eliminado_en), así no hay DELETE.
create table if not exists public.proveedores (
  id uuid primary key,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  telefono text,
  visita text,
  nota text,
  deuda bigint not null default 0 check (deuda >= 0),
  eliminado_en timestamptz,
  actualizado_en timestamptz not null default now());
create unique index if not exists proveedores_id_negocio on public.proveedores (id, negocio_id);
create index if not exists proveedores_negocio_actualizado on public.proveedores (negocio_id, actualizado_en);
alter table public.proveedores enable row level security;
grant select on table public.proveedores to authenticated;
grant insert (id, negocio_id, nombre, telefono, visita, nota, deuda, eliminado_en), update (nombre, telefono, visita, nota, deuda, eliminado_en) on table public.proveedores to authenticated;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='proveedores' and policyname='con_suscripcion_activa') then
    create policy con_suscripcion_activa on public.proveedores for all to authenticated
      using (negocio_id in (select private.negocios_con_acceso())) with check (negocio_id in (select private.negocios_con_acceso()));
  end if;
  if not exists (select 1 from pg_policies where tablename='proveedores' and policyname='solo_dueno_inserta') then
    create policy solo_dueno_inserta on public.proveedores as restrictive for insert to authenticated with check ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_policies where tablename='proveedores' and policyname='solo_dueno_modifica') then
    create policy solo_dueno_modifica on public.proveedores as restrictive for update to authenticated using ((select private.es_dueno(negocio_id))) with check ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_trigger where tgname='marca_actualizado' and tgrelid='public.proveedores'::regclass) then
    create trigger marca_actualizado before update on public.proveedores for each row execute function public.marca_actualizado();
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='proveedores') then
    alter publication supabase_realtime add table public.proveedores;
  end if;
end $$;

alter table public.productos add column if not exists proveedor_id uuid;
grant insert (proveedor_id), update (proveedor_id) on table public.productos to authenticated;

-- El vendedor tampoco cambia el proveedor de un producto.
create or replace function private.productos_cuidar_ficha() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.es_dueno(old.negocio_id) then return new; end if;
  if new.id is distinct from old.id or new.negocio_id is distinct from old.negocio_id or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'sólo el dueño puede borrar productos' using errcode = '42501';
  end if;
  new.nombre := old.nombre; new.codigo_barras := old.codigo_barras; new.costo := old.costo; new.precio := old.precio;
  new.stock_minimo := old.stock_minimo; new.precio_oferta := old.precio_oferta; new.oferta_hasta := old.oferta_hasta;
  new.unidad := old.unidad; new.categoria := old.categoria; new.proveedor_id := old.proveedor_id;
  if coalesce(pg_catalog.current_setting('libreta.movimiento_stock', true), '') <> 'si' then new.stock := old.stock; end if;
  return new;
end $$;
