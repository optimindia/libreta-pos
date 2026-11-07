-- Mejora #1 (7/11): aplica en producción, en pasos que sólo agregan, lo que
-- 20261028140000 (permisos del vendedor), 20261028141000 (intentos de
-- ingreso), 20261029120100 (firma propia y turno) y 20261030120000
-- (recuperación de PIN) describían y nunca se había aplicado.
--
-- Diferencias con aquellos archivos:
--   * Las políticas y los triggers se crean sólo si no existen (sin DROP).
--   * Las políticas de cierres nacen ya en su versión final (el vendedor puede
--     subir el cierre de SU turno).
--   * registrar_movimiento_stock conserva la versión numérica (kilo/litro) y
--     la venta que deja el stock en 0 en vez de rechazarse; suma el chequeo
--     de rol y la marca libreta.movimiento_stock que reconoce el trigger.
--   * productos_cuidar_ficha también conserva unidad y categoría.
--   * Las tablas nuevas no llevan REVOKE: tienen RLS forzada y sin políticas,
--     así que el navegador no puede leerlas ni escribirlas igual.
-- Probado en transacciones revertidas como dueño (todo pasa) y como vendedor
-- (precio se conserva, ajuste/anulación/caja 42501, venta pasa).

create or replace function private.es_dueno(p_negocio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios_negocio un where un.usuario_id = (select auth.uid()) and un.negocio_id = p_negocio and un.rol = 'dueno')
$$;
grant execute on function private.es_dueno(uuid) to authenticated;

create or replace function private.producto_existe(p_id uuid, p_negocio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.productos p where p.id = p_id and p.negocio_id = p_negocio)
$$;
grant execute on function private.producto_existe(uuid, uuid) to authenticated;

do $$
declare tabla text;
begin
  foreach tabla in array array['negocio_configuracion','movimientos_caja','ingresos','ingreso_items'] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tabla and policyname='solo_dueno_inserta') then
      execute format('create policy solo_dueno_inserta on public.%I as restrictive for insert to authenticated with check ((select private.es_dueno(negocio_id)))', tabla);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tabla and policyname='solo_dueno_modifica') then
      execute format('create policy solo_dueno_modifica on public.%I as restrictive for update to authenticated using ((select private.es_dueno(negocio_id))) with check ((select private.es_dueno(negocio_id)))', tabla);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=tabla and policyname='solo_dueno_borra') then
      execute format('create policy solo_dueno_borra on public.%I as restrictive for delete to authenticated using ((select private.es_dueno(negocio_id)))', tabla);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cierres' and policyname='solo_dueno_inserta') then
    create policy solo_dueno_inserta on public.cierres as restrictive for insert to authenticated
      with check ((select private.es_dueno(negocio_id)) or (alcance = 'turno' and usuario_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cierres' and policyname='solo_dueno_modifica') then
    create policy solo_dueno_modifica on public.cierres as restrictive for update to authenticated
      using ((select private.es_dueno(negocio_id)) or (alcance = 'turno' and usuario_id = (select auth.uid())))
      with check ((select private.es_dueno(negocio_id)) or (alcance = 'turno' and usuario_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='cierres' and policyname='solo_dueno_borra') then
    create policy solo_dueno_borra on public.cierres as restrictive for delete to authenticated using ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='productos' and policyname='solo_dueno_inserta') then
    create policy solo_dueno_inserta on public.productos as restrictive for insert to authenticated
      with check ((select private.es_dueno(negocio_id)) or private.producto_existe(id, negocio_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='productos' and policyname='solo_dueno_borra') then
    create policy solo_dueno_borra on public.productos as restrictive for delete to authenticated using ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clientes' and policyname='solo_dueno_borra') then
    create policy solo_dueno_borra on public.clientes as restrictive for delete to authenticated using ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='movimientos_stock' and policyname='vendedor_solo_ventas') then
    create policy vendedor_solo_ventas on public.movimientos_stock as restrictive for insert to authenticated
      with check ((origen = 'venta' and cantidad < 0) or (select private.es_dueno(negocio_id)));
  end if;
  -- firma propia: un vendedor sólo firma con su id (o ninguno).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ventas' and policyname='firma_propia_inserta') then
    create policy firma_propia_inserta on public.ventas as restrictive for insert to authenticated
      with check ((select private.es_dueno(negocio_id)) or vendido_por is null or vendido_por = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ventas' and policyname='firma_propia_modifica') then
    create policy firma_propia_modifica on public.ventas as restrictive for update to authenticated using (true)
      with check ((select private.es_dueno(negocio_id)) or vendido_por is null or vendido_por = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fiado_pagos' and policyname='firma_propia_inserta') then
    create policy firma_propia_inserta on public.fiado_pagos as restrictive for insert to authenticated
      with check ((select private.es_dueno(negocio_id)) or usuario_id is null or usuario_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fiado_pagos' and policyname='firma_propia_modifica') then
    create policy firma_propia_modifica on public.fiado_pagos as restrictive for update to authenticated using (true)
      with check ((select private.es_dueno(negocio_id)) or usuario_id is null or usuario_id = (select auth.uid()));
  end if;
end $$;

create or replace function private.productos_cuidar_ficha() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is null or private.es_dueno(old.negocio_id) then return new; end if;
  if new.id is distinct from old.id or new.negocio_id is distinct from old.negocio_id or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'sólo el dueño puede borrar productos' using errcode = '42501';
  end if;
  new.nombre := old.nombre; new.codigo_barras := old.codigo_barras; new.costo := old.costo; new.precio := old.precio;
  new.stock_minimo := old.stock_minimo; new.precio_oferta := old.precio_oferta; new.oferta_hasta := old.oferta_hasta;
  new.unidad := old.unidad; new.categoria := old.categoria;
  if coalesce(pg_catalog.current_setting('libreta.movimiento_stock', true), '') <> 'si' then new.stock := old.stock; end if;
  return new;
end $$;

create or replace function private.solo_dueno_anula() returns trigger language plpgsql set search_path = '' as $$
declare v_anula boolean;
begin
  if (select auth.uid()) is null or private.es_dueno(new.negocio_id) then return new; end if;
  if tg_table_name = 'ventas' then
    v_anula := new.estado = 'anulada' and (tg_op = 'INSERT' or old.estado is distinct from 'anulada');
  else
    v_anula := new.anulado_en is not null and (tg_op = 'INSERT' or old.anulado_en is null);
  end if;
  if v_anula then raise exception 'sólo el dueño puede anular' using errcode = '42501'; end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname='productos_cuidar_ficha' and tgrelid='public.productos'::regclass) then
    create trigger productos_cuidar_ficha before update on public.productos for each row execute function private.productos_cuidar_ficha();
  end if;
  if not exists (select 1 from pg_trigger where tgname='solo_dueno_anula' and tgrelid='public.ventas'::regclass) then
    create trigger solo_dueno_anula before insert or update on public.ventas for each row execute function private.solo_dueno_anula();
  end if;
  if not exists (select 1 from pg_trigger where tgname='solo_dueno_anula' and tgrelid='public.fiados'::regclass) then
    create trigger solo_dueno_anula before insert or update on public.fiados for each row execute function private.solo_dueno_anula();
  end if;
end $$;

create or replace function public.registrar_movimiento_stock(p_movimiento_id uuid, p_negocio_id uuid, p_producto_id uuid, p_cantidad numeric, p_origen text, p_referencia_id uuid)
returns numeric language plpgsql set search_path = '' as $$
declare v_stock numeric; v_insertado boolean;
begin
  if (select auth.uid()) is null then raise exception 'hay que iniciar sesión'; end if;
  if p_cantidad = 0 or p_origen not in ('ajuste', 'venta', 'anulacion', 'ingreso') then raise exception 'movimiento de stock inválido'; end if;
  if not exists (select 1 from private.negocios_con_acceso() as acceso(negocio_id) where acceso.negocio_id = p_negocio_id) then
    raise exception 'sin permiso para este negocio';
  end if;
  if not private.es_dueno(p_negocio_id) and not (p_origen = 'venta' and p_cantidad < 0) then
    raise exception 'sólo el dueño puede ajustar o cargar stock' using errcode = '42501';
  end if;
  insert into public.movimientos_stock (id, negocio_id, producto_id, cantidad, origen, referencia_id)
  values (p_movimiento_id, p_negocio_id, p_producto_id, p_cantidad, p_origen, p_referencia_id)
  on conflict (id) do nothing returning true into v_insertado;
  if v_insertado is null then
    select stock into v_stock from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
    return v_stock;
  end if;
  perform pg_catalog.set_config('libreta.movimiento_stock', 'si', true);
  if p_origen = 'venta' then
    update public.productos set stock = greatest(stock + p_cantidad, 0)
    where id = p_producto_id and negocio_id = p_negocio_id returning stock into v_stock;
  else
    update public.productos set stock = stock + p_cantidad
    where id = p_producto_id and negocio_id = p_negocio_id and eliminado_en is null and stock + p_cantidad >= 0
    returning stock into v_stock;
  end if;
  perform pg_catalog.set_config('libreta.movimiento_stock', '', true);
  if v_stock is null then raise exception 'stock insuficiente o producto inexistente'; end if;
  return v_stock;
end $$;

create table if not exists public.intentos_ingreso (
  telefono text primary key,
  fallos integer not null default 0 check (fallos >= 0),
  desde timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  version bigint not null default 1,
  actualizado_en timestamptz not null default now());
alter table public.intentos_ingreso enable row level security;
alter table public.intentos_ingreso force row level security;
grant select, insert, update, delete on table public.intentos_ingreso to service_role;
create index if not exists intentos_ingreso_actualizado_en on public.intentos_ingreso (actualizado_en);

create table if not exists public.recuperacion_pin_codigos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  codigo_hash text not null,
  creado_en timestamptz not null default now(),
  usado_en timestamptz);
alter table public.recuperacion_pin_codigos enable row level security;
alter table public.recuperacion_pin_codigos force row level security;
grant select, insert, update, delete on table public.recuperacion_pin_codigos to service_role;

alter table public.usuarios_negocio add column if not exists debe_cambiar_pin boolean not null default false;
grant select (debe_cambiar_pin) on table public.usuarios_negocio to authenticated;

grant insert (posicion), update (posicion) on table public.venta_items to authenticated;
grant insert (posicion), update (posicion) on table public.ingreso_items to authenticated;
grant insert (posicion), update (posicion) on table public.pedido_items to authenticated;
grant delete on table public.venta_items, public.ingreso_items, public.pedido_items to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements) values
 ('20261028140000','permisos_vendedor', array['aplicada en partes 2026-11-07, ver 20261107010000']),
 ('20261028141000','intentos_ingreso', array['aplicada 2026-11-07']),
 ('20261029120100','firma_propia_y_turno', array['aplicada en partes 2026-11-07']),
 ('20261030120000','recuperacion_pin', array['aplicada 2026-11-07']),
 ('20261107010000','permisos_vendedor_aplicados', array['ver archivo'])
on conflict do nothing;
