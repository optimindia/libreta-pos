-- Preferencias por negocio para Libreta.
-- Ejecutar después de migracion-seguridad-plataforma.sql.
-- Idempotente: puede ejecutarse más de una vez sin perder configuraciones.
-- La tabla no guarda secretos ni datos de facturación; sólo controla qué
-- módulos y herramientas ve cada negocio.

create table if not exists public.negocio_configuracion (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  funciones jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  constraint negocio_configuracion_funciones_objeto
    check (jsonb_typeof(funciones) = 'object'),
  constraint negocio_configuracion_funciones_tamano
    check (pg_catalog.octet_length(funciones::text) <= 10000)
);

create index if not exists negocio_configuracion_actualizado_idx
  on public.negocio_configuracion (actualizado_en);

create or replace function public.marca_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = pg_catalog.now();
  return new;
end
$$;
revoke all on function public.marca_actualizado() from public, anon, authenticated;

drop trigger if exists negocio_configuracion_marca_actualizado
  on public.negocio_configuracion;
create trigger negocio_configuracion_marca_actualizado
  before insert or update on public.negocio_configuracion
  for each row execute function public.marca_actualizado();

alter table public.negocio_configuracion enable row level security;
revoke all on table public.negocio_configuracion from public, anon, authenticated;
grant select on table public.negocio_configuracion to authenticated;
-- El cliente puede enviar su marca local para ordenar conflictos, pero el
-- trigger la reemplaza siempre por el reloj del servidor.
grant insert (negocio_id, funciones, actualizado_en) on table public.negocio_configuracion to authenticated;
grant update (negocio_id, funciones, actualizado_en) on table public.negocio_configuracion to authenticated;

drop policy if exists con_suscripcion_activa on public.negocio_configuracion;
drop policy if exists negocio_configuracion_select on public.negocio_configuracion;
create policy negocio_configuracion_select
  on public.negocio_configuracion
  for select to authenticated
  using (negocio_id in (select private.negocios_con_acceso()));

drop policy if exists negocio_configuracion_insert on public.negocio_configuracion;
create policy negocio_configuracion_insert
  on public.negocio_configuracion
  for insert to authenticated
  with check (negocio_id in (select private.negocios_con_acceso()));

drop policy if exists negocio_configuracion_update on public.negocio_configuracion;
create policy negocio_configuracion_update
  on public.negocio_configuracion
  for update to authenticated
  using (negocio_id in (select private.negocios_con_acceso()))
  with check (negocio_id in (select private.negocios_con_acceso()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'negocio_configuracion'
  ) then
    execute 'alter publication supabase_realtime add table public.negocio_configuracion';
  end if;
  execute 'alter table public.negocio_configuracion replica identity full';
end
$$;
