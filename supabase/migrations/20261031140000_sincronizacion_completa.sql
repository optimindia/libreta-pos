-- Auditoría de sincronización (31/10): todo lo que se cambia en un aparato
-- tiene que llegar a los demás. Aditiva: columnas nuevas NULLABLE o con
-- default, permisos por columna, una tabla de borrados y una política de
-- edición del negocio para el dueño. No borra ni reescribe datos.
--
-- Recordatorio: los permisos de `authenticated` son POR COLUMNA. Cada
-- columna que la app sube necesita su GRANT (ver README).

-- 1. Datos que antes quedaban sólo en el aparato ---------------------------------
alter table public.productos
  add column if not exists categoria text,
  add column if not exists favorito boolean not null default false;
grant insert (categoria, favorito), update (categoria, favorito) on table public.productos to authenticated;

alter table public.clientes
  add column if not exists limite_fiado bigint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_limite_fiado_valido') then
    alter table public.clientes
      add constraint clientes_limite_fiado_valido check (limite_fiado is null or limite_fiado >= 0);
  end if;
end $$;
grant insert (limite_fiado), update (limite_fiado) on table public.clientes to authenticated;

-- El cierre de caja guarda también las entradas y salidas manuales: sin
-- estas columnas la subida fallaba y el cierre no llegaba a ningún lado.
alter table public.cierres
  add column if not exists entradas_caja bigint,
  add column if not exists salidas_caja bigint;
grant insert (entradas_caja, salidas_caja), update (entradas_caja, salidas_caja) on table public.cierres to authenticated;

-- Metas y leyenda del ticket: del negocio, no del aparato.
alter table public.negocio_configuracion
  add column if not exists ajustes jsonb not null default '{}'::jsonb;
grant insert (ajustes), update (ajustes) on table public.negocio_configuracion to authenticated;

-- 2. Nombre, logo y color del negocio ------------------------------------------------
-- Antes no se podían cambiar desde la app: el cambio quedaba en el aparato y
-- la próxima verificación lo pisaba con el valor viejo de la nube.
alter table public.negocios
  add column if not exists actualizado_en timestamptz not null default now();
drop trigger if exists marca_actualizado on public.negocios;
create trigger marca_actualizado before update on public.negocios
  for each row execute function public.marca_actualizado();
grant update (nombre, logo, color) on table public.negocios to authenticated;
drop policy if exists dueno_edita_su_negocio on public.negocios;
create policy dueno_edita_su_negocio on public.negocios
  for update to authenticated
  using (exists (
    select 1 from public.usuarios_negocio u
    where u.negocio_id = negocios.id and u.usuario_id = (select auth.uid()) and u.rol = 'dueno'
  ))
  with check (exists (
    select 1 from public.usuarios_negocio u
    where u.negocio_id = negocios.id and u.usuario_id = (select auth.uid()) and u.rol = 'dueno'
  ));

-- 3. Borrados ------------------------------------------------------------------------
-- Un DELETE no deja fila que bajar: los otros aparatos nunca se enteraban de
-- un cliente o un movimiento de caja borrado. Cada borrado deja una marca.
create table if not exists public.borrados (
  tabla text not null,
  id uuid not null,
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  actualizado_en timestamptz not null default now(),
  primary key (tabla, id)
);
create index if not exists borrados_negocio_actualizado on public.borrados (negocio_id, actualizado_en);
alter table public.borrados enable row level security;
revoke all on table public.borrados from anon, authenticated;
grant select on table public.borrados to authenticated;
drop policy if exists leer_borrados_de_mi_negocio on public.borrados;
create policy leer_borrados_de_mi_negocio on public.borrados
  for select to authenticated
  using (negocio_id in (select private.negocios_con_acceso()));

create or replace function private.registrar_borrado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.borrados (tabla, id, negocio_id)
  values (tg_table_name, old.id, old.negocio_id)
  on conflict (tabla, id) do update set actualizado_en = pg_catalog.now();
  return old;
end
$$;
revoke all on function private.registrar_borrado() from public, anon, authenticated;

do $$
declare
  tabla text;
begin
  foreach tabla in array array['clientes', 'movimientos_caja', 'ventas', 'fiados', 'fiado_pagos', 'ingresos', 'cierres', 'pedidos', 'productos'] loop
    execute format('drop trigger if exists registra_borrado on public.%I', tabla);
    execute format('create trigger registra_borrado after delete on public.%I for each row execute function private.registrar_borrado()', tabla);
  end loop;
end $$;

-- 4. Avisos en vivo --------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'borrados') then
    alter publication supabase_realtime add table public.borrados;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'negocios') then
    alter publication supabase_realtime add table public.negocios;
  end if;
end $$;

-- 5. Ventas de dos aparatos a la vez ---------------------------------------------------
-- Si dos aparatos venden sin señal la última unidad, la venta ya ocurrió: el
-- stock queda en 0 en vez de rechazar el movimiento para siempre (que
-- además dejaba al producto sin actualizarse en ese aparato).
create or replace function public.registrar_movimiento_stock(
  p_movimiento_id uuid,
  p_negocio_id uuid,
  p_producto_id uuid,
  p_cantidad numeric,
  p_origen text,
  p_referencia_id uuid
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_stock numeric;
  v_insertado boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'hay que iniciar sesión';
  end if;
  if p_cantidad = 0 or p_origen not in ('ajuste', 'venta', 'anulacion', 'ingreso') then
    raise exception 'movimiento de stock inválido';
  end if;
  if not exists (
    select 1 from private.negocios_con_acceso() as acceso(negocio_id)
    where acceso.negocio_id = p_negocio_id
  ) then
    raise exception 'sin permiso para este negocio';
  end if;

  insert into public.movimientos_stock (id, negocio_id, producto_id, cantidad, origen, referencia_id)
  values (p_movimiento_id, p_negocio_id, p_producto_id, p_cantidad, p_origen, p_referencia_id)
  on conflict (id) do nothing
  returning true into v_insertado;

  if not found then
    select stock into v_stock
    from public.productos
    where id = p_producto_id and negocio_id = p_negocio_id;
    return v_stock;
  end if;

  if p_origen = 'venta' then
    update public.productos
    set stock = greatest(stock + p_cantidad, 0)
    where id = p_producto_id
      and negocio_id = p_negocio_id
    returning stock into v_stock;
  else
    update public.productos
    set stock = stock + p_cantidad
    where id = p_producto_id
      and negocio_id = p_negocio_id
      and eliminado_en is null
      and stock + p_cantidad >= 0
    returning stock into v_stock;
  end if;

  if not found then
    raise exception 'stock insuficiente o producto inexistente';
  end if;
  return v_stock;
end
$$;

-- 6. Reservas en vivo -------------------------------------------------------------------
-- Cada aparato avisa por Presence lo que lleva en sus ventas abiertas, en el
-- canal privado `reservas:<negocio_id>`. No se guarda nada: sólo se controla
-- quién puede entrar al canal (quien tiene acceso a ese negocio).
drop policy if exists reservas_del_negocio_leer on realtime.messages;
create policy reservas_del_negocio_leer on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) in (
      select 'reservas:' || acceso::text from private.negocios_con_acceso() as acceso
    )
  );
drop policy if exists reservas_del_negocio_avisar on realtime.messages;
create policy reservas_del_negocio_avisar on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) in (
      select 'reservas:' || acceso::text from private.negocios_con_acceso() as acceso
    )
  );
