-- SEG-02: los permisos del vendedor viven en la base, no sólo en pantalla.
--
-- El dueño sigue pudiendo todo lo de antes. El vendedor (usuarios_negocio.rol
-- = 'vendedor') vende, fía, cobra fiados, atiende clientes y pedidos, y mira
-- stock e historial; la base ahora le niega:
--   * negocio_configuracion: crear, modificar o borrar (Ajustes es del dueño).
--   * movimientos_caja y cierres: crear, modificar o borrar (Plata es del dueño).
--   * ingresos e ingreso_items: crear, modificar o borrar (cargar mercadería
--     y sus costos es del dueño).
--   * productos: crear o borrar (también el borrado lógico por eliminado_en).
--     Modificar sí, porque cada venta sube la ficha de los productos tocados,
--     pero un trigger conserva nombre, código, costo, precio, mínimo y oferta
--     tal como están en la base, y el stock sólo cambia por el RPC atómico.
--   * clientes: borrar.
--   * ventas y fiados: anular (la anulación devuelve stock y plata).
--   * registrar_movimiento_stock y movimientos_stock: sólo descuentos por
--     venta (origen 'venta' con cantidad negativa); ajustes, ingresos y
--     anulaciones son del dueño.
--
-- Cómo: las políticas PERMISSIVE existentes (con_suscripcion_activa y las de
-- negocio_configuracion / movimientos_stock) quedan intactas y se suman
-- políticas RESTRICTIVE por comando. Postgres exige que pase al menos una
-- permisiva Y todas las restrictivas, así que para el dueño nada cambia.
-- Ojo: un DELETE que una restrictiva filtra no da error, borra 0 filas.
--
-- Lo que NO se hace: ocultarle el costo al vendedor. Dueño y vendedor entran
-- con el mismo rol de Postgres (authenticated), así que un permiso por
-- columna los afectaría a los dos, y la bajada usa select=* (que exige leer
-- todas las columnas). Hacerlo bien pide vistas o RPCs propias por rol.
--
-- De paso arregla permisos que la subida de renglones ya necesita (migración
-- 20261028120000): `posicion` en venta_items / ingreso_items y el DELETE de
-- los renglones sobrantes en las tres tablas de items. Sin esto, subir una
-- venta con items falla con 42501 para dueños y vendedores por igual.
--
-- Aditiva y reversible: el SQL para revertir está comentado al final.

-- 1. ¿Quien llama es dueño de este negocio? -----------------------------------
create or replace function private.es_dueno(p_negocio uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios_negocio un
    where un.usuario_id = (select auth.uid())
      and un.negocio_id = p_negocio
      and un.rol = 'dueno'
  )
$$;
revoke all on function private.es_dueno(uuid) from public, anon;
grant execute on function private.es_dueno(uuid) to authenticated;

-- 2. Políticas restrictivas ----------------------------------------------------
-- negocio_configuracion: el vendedor la lee (la app necesita saber qué
-- funciones están prendidas) pero no la cambia.
-- movimientos_caja, cierres, ingresos, ingreso_items: lectura igual que antes;
-- escritura sólo dueño.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'negocio_configuracion', 'movimientos_caja', 'cierres', 'ingresos', 'ingreso_items'
  ] loop
    execute format('drop policy if exists solo_dueno_inserta on public.%I', tabla);
    execute format($p$
      create policy solo_dueno_inserta on public.%I
        as restrictive for insert to authenticated
        with check ((select private.es_dueno(negocio_id)))
    $p$, tabla);
    execute format('drop policy if exists solo_dueno_modifica on public.%I', tabla);
    execute format($p$
      create policy solo_dueno_modifica on public.%I
        as restrictive for update to authenticated
        using ((select private.es_dueno(negocio_id)))
        with check ((select private.es_dueno(negocio_id)))
    $p$, tabla);
    execute format('drop policy if exists solo_dueno_borra on public.%I', tabla);
    execute format($p$
      create policy solo_dueno_borra on public.%I
        as restrictive for delete to authenticated
        using ((select private.es_dueno(negocio_id)))
    $p$, tabla);
  end loop;
end $$;

-- productos: alta y borrado sólo dueño. El UPDATE queda abierto (lo usan la
-- subida de la venta y el RPC de stock) y lo acota el trigger de abajo.
-- Cuidado: un upsert (INSERT ... ON CONFLICT DO UPDATE) evalúa el WITH CHECK
-- de INSERT aunque termine actualizando (probado en Postgres 16). La venta
-- del vendedor sube la ficha con upsert, así que la política deja pasar la
-- fila propuesta cuando el producto ya existe en ese negocio: ese upsert va
-- a caer en el UPDATE, que el trigger acota. Un alta de verdad, no.
create or replace function private.producto_existe(p_id uuid, p_negocio uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.productos p
    where p.id = p_id and p.negocio_id = p_negocio
  )
$$;
revoke all on function private.producto_existe(uuid, uuid) from public, anon;
grant execute on function private.producto_existe(uuid, uuid) to authenticated;

drop policy if exists solo_dueno_inserta on public.productos;
create policy solo_dueno_inserta on public.productos
  as restrictive for insert to authenticated
  with check (
    (select private.es_dueno(negocio_id))
    or private.producto_existe(id, negocio_id)
  );
drop policy if exists solo_dueno_borra on public.productos;
create policy solo_dueno_borra on public.productos
  as restrictive for delete to authenticated
  using ((select private.es_dueno(negocio_id)));

-- clientes: el vendedor los carga y edita, no los borra.
drop policy if exists solo_dueno_borra on public.clientes;
create policy solo_dueno_borra on public.clientes
  as restrictive for delete to authenticated
  using ((select private.es_dueno(negocio_id)));

-- movimientos_stock: además del RPC, la tabla tiene INSERT directo. El
-- vendedor sólo puede dejar constancia de lo que vende.
drop policy if exists vendedor_solo_ventas on public.movimientos_stock;
create policy vendedor_solo_ventas on public.movimientos_stock
  as restrictive for insert to authenticated
  with check (
    (origen = 'venta' and cantidad < 0)
    or (select private.es_dueno(negocio_id))
  );

-- 3. La ficha del producto la decide el dueño ----------------------------------
-- Para un vendedor: los datos comerciales se conservan en silencio (la
-- subida de la venta no se traba si el teléfono tenía un precio viejo, y la
-- respuesta del upsert le devuelve al aparato los valores reales); el stock
-- sólo se mueve dentro de registrar_movimiento_stock; borrar o mudar el
-- producto se rechaza con 42501.
create or replace function private.productos_cuidar_ficha()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sin usuario (service_role, editor SQL, panel Edge): no se toca nada.
  if (select auth.uid()) is null or private.es_dueno(old.negocio_id) then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.negocio_id is distinct from old.negocio_id
     or new.eliminado_en is distinct from old.eliminado_en then
    raise exception 'sólo el dueño puede borrar productos'
      using errcode = '42501';
  end if;
  new.nombre := old.nombre;
  new.codigo_barras := old.codigo_barras;
  new.costo := old.costo;
  new.precio := old.precio;
  new.stock_minimo := old.stock_minimo;
  new.precio_oferta := old.precio_oferta;
  new.oferta_hasta := old.oferta_hasta;
  if coalesce(pg_catalog.current_setting('libreta.movimiento_stock', true), '') <> 'si' then
    new.stock := old.stock;
  end if;
  return new;
end
$$;
revoke all on function private.productos_cuidar_ficha() from public, anon, authenticated;

drop trigger if exists productos_cuidar_ficha on public.productos;
create trigger productos_cuidar_ficha
  before update on public.productos
  for each row execute function private.productos_cuidar_ficha();

-- 4. Anular es del dueño -------------------------------------------------------
-- Anular una venta devuelve stock y saca plata de la caja; anular un fiado
-- borra una deuda. El vendedor puede subir y re-subir sus ventas y fiados
-- (los reintentos caen en el UPDATE del upsert), pero no pasarlos a anulados.
create or replace function private.solo_dueno_anula()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_anula boolean;
begin
  if (select auth.uid()) is null or private.es_dueno(new.negocio_id) then
    return new;
  end if;
  if tg_table_name = 'ventas' then
    v_anula := new.estado = 'anulada'
      and (tg_op = 'INSERT' or old.estado is distinct from 'anulada');
  else
    v_anula := new.anulado_en is not null
      and (tg_op = 'INSERT' or old.anulado_en is null);
  end if;
  if v_anula then
    raise exception 'sólo el dueño puede anular'
      using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function private.solo_dueno_anula() from public, anon, authenticated;

drop trigger if exists solo_dueno_anula on public.ventas;
create trigger solo_dueno_anula
  before insert or update on public.ventas
  for each row execute function private.solo_dueno_anula();
drop trigger if exists solo_dueno_anula on public.fiados;
create trigger solo_dueno_anula
  before insert or update on public.fiados
  for each row execute function private.solo_dueno_anula();

-- 5. Stock atómico: el vendedor sólo descuenta lo que vende --------------------
-- Mismo cuerpo que antes más dos cosas: el chequeo de rol y la marca
-- transaccional que el trigger reconoce como "este cambio de stock viene del
-- RPC". set_config(..., true) dura hasta el fin de la transacción, y cada
-- pedido de PostgREST es su propia transacción. Como `perform` pisa FOUND,
-- el resultado del UPDATE se mira en v_stock.
create or replace function public.registrar_movimiento_stock(
  p_movimiento_id uuid,
  p_negocio_id uuid,
  p_producto_id uuid,
  p_cantidad integer,
  p_origen text,
  p_referencia_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stock integer;
begin
  if (select auth.uid()) is null then raise exception 'hay que iniciar sesión'; end if;
  if p_cantidad = 0 or p_origen not in ('ajuste', 'venta', 'anulacion', 'ingreso') then
    raise exception 'movimiento de stock inválido';
  end if;
  if not exists (
    select 1 from private.negocios_con_acceso() as acceso(negocio_id)
    where acceso.negocio_id = p_negocio_id
  ) then raise exception 'sin permiso para este negocio'; end if;
  if not private.es_dueno(p_negocio_id) and not (p_origen = 'venta' and p_cantidad < 0) then
    raise exception 'sólo el dueño puede ajustar o cargar stock'
      using errcode = '42501';
  end if;

  insert into public.movimientos_stock (id, negocio_id, producto_id, cantidad, origen, referencia_id)
  values (p_movimiento_id, p_negocio_id, p_producto_id, p_cantidad, p_origen, p_referencia_id)
  on conflict (id) do nothing;
  if not found then
    select stock into v_stock from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
    return v_stock;
  end if;

  perform pg_catalog.set_config('libreta.movimiento_stock', 'si', true);
  update public.productos
  set stock = stock + p_cantidad
  where id = p_producto_id and negocio_id = p_negocio_id and eliminado_en is null and stock + p_cantidad >= 0
  returning stock into v_stock;
  perform pg_catalog.set_config('libreta.movimiento_stock', '', true);
  if v_stock is null then raise exception 'stock insuficiente o producto inexistente'; end if;
  return v_stock;
end
$$;
revoke all on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) to authenticated;

-- 6. Permisos que la subida de renglones necesita ------------------------------
grant insert (posicion), update (posicion) on table public.venta_items to authenticated;
grant insert (posicion), update (posicion) on table public.ingreso_items to authenticated;
grant insert (posicion), update (posicion) on table public.pedido_items to authenticated;
grant delete on table public.venta_items, public.ingreso_items, public.pedido_items to authenticated;

-- Verificación rápida (como postgres, en una rama o local):
--   select tablename, policyname, permissive, cmd from pg_policies
--   where schemaname = 'public'
--     and (policyname like 'solo_dueno%' or policyname = 'vendedor_solo_ventas')
--   order by 1, 2;   -- 19 filas
--   select tgrelid::regclass, tgname from pg_trigger
--   where tgname in ('productos_cuidar_ficha', 'solo_dueno_anula');  -- 3 filas

-- ---------------------------------------------------------------------------
-- REVERTIR (copiar sin los "-- " y ejecutar como postgres):
--
-- do $$
-- declare tabla text;
-- begin
--   foreach tabla in array array['negocio_configuracion', 'movimientos_caja', 'cierres', 'ingresos', 'ingreso_items'] loop
--     execute format('drop policy if exists solo_dueno_inserta on public.%I', tabla);
--     execute format('drop policy if exists solo_dueno_modifica on public.%I', tabla);
--     execute format('drop policy if exists solo_dueno_borra on public.%I', tabla);
--   end loop;
-- end $$;
-- drop policy if exists solo_dueno_inserta on public.productos;
-- drop policy if exists solo_dueno_borra on public.productos;
-- drop function if exists private.producto_existe(uuid, uuid);
-- drop policy if exists solo_dueno_borra on public.clientes;
-- drop policy if exists vendedor_solo_ventas on public.movimientos_stock;
-- drop trigger if exists productos_cuidar_ficha on public.productos;
-- drop function if exists private.productos_cuidar_ficha();
-- drop trigger if exists solo_dueno_anula on public.ventas;
-- drop trigger if exists solo_dueno_anula on public.fiados;
-- drop function if exists private.solo_dueno_anula();
-- create or replace function public.registrar_movimiento_stock(
--   p_movimiento_id uuid, p_negocio_id uuid, p_producto_id uuid,
--   p_cantidad integer, p_origen text, p_referencia_id uuid default null
-- ) returns integer language plpgsql security invoker set search_path = '' as $$
-- declare v_stock integer;
-- begin
--   if (select auth.uid()) is null then raise exception 'hay que iniciar sesión'; end if;
--   if p_cantidad = 0 or p_origen not in ('ajuste', 'venta', 'anulacion', 'ingreso') then
--     raise exception 'movimiento de stock inválido';
--   end if;
--   if not exists (
--     select 1 from private.negocios_con_acceso() as acceso(negocio_id)
--     where acceso.negocio_id = p_negocio_id
--   ) then raise exception 'sin permiso para este negocio'; end if;
--   insert into public.movimientos_stock (id, negocio_id, producto_id, cantidad, origen, referencia_id)
--   values (p_movimiento_id, p_negocio_id, p_producto_id, p_cantidad, p_origen, p_referencia_id)
--   on conflict (id) do nothing;
--   if not found then
--     select stock into v_stock from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
--     return v_stock;
--   end if;
--   update public.productos set stock = stock + p_cantidad
--   where id = p_producto_id and negocio_id = p_negocio_id and eliminado_en is null and stock + p_cantidad >= 0
--   returning stock into v_stock;
--   if not found then raise exception 'stock insuficiente o producto inexistente'; end if;
--   return v_stock;
-- end $$;
-- drop function if exists private.es_dueno(uuid);
-- -- Los permisos de la sección 6 conviene dejarlos: la subida de renglones
-- -- los necesita. Si igual se quieren sacar:
-- -- revoke delete on table public.venta_items, public.ingreso_items, public.pedido_items from authenticated;
-- -- revoke insert (posicion), update (posicion) on table public.venta_items, public.ingreso_items from authenticated;
