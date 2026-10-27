-- Endurecimiento de Libreta SaaS.
-- Se ejecuta después de migracion-suscripciones-manuales.sql.
-- Es idempotente y falla cerrado: un cliente sólo puede operar con una
-- suscripción prueba/activa cuyo vencimiento todavía no llegó.

create schema if not exists private;

-- Estos helpers no se publican por PostgREST. SECURITY DEFINER sólo se usa
-- para consultar el vínculo que tiene RLS; la identidad siempre sale de JWT.
create or replace function private.negocios_del_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select negocio_id
  from public.usuarios_negocio
  where usuario_id = (select auth.uid())
$$;

create or replace function private.negocios_con_acceso()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select un.negocio_id
  from public.usuarios_negocio un
  where un.usuario_id = (select auth.uid())
    and exists (
      select 1
      from public.suscripciones s
      where s.negocio_id = un.negocio_id
        and s.estado in ('prueba', 'activa')
        and s.vence_en > pg_catalog.now()
    )
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.negocios_del_usuario() from public, anon;
revoke all on function private.negocios_con_acceso() from public, anon;
grant execute on function private.negocios_del_usuario() to authenticated;
grant execute on function private.negocios_con_acceso() to authenticated;

-- El helper anterior estaba en public y podía invocarse como RPC por un JWT.
-- Las políticas ya no dependen de él, así que se elimina por completo.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'productos', 'ventas', 'venta_items', 'clientes', 'fiados',
    'fiado_pagos', 'ingresos', 'ingreso_items', 'cierres',
    'movimientos_caja', 'ventas_resumen'
  ] loop
    execute format('drop policy if exists solo_mi_negocio on public.%I', tabla);
    execute format('drop policy if exists con_suscripcion_activa on public.%I', tabla);
    execute format('alter table public.%I enable row level security', tabla);
    execute format($policy$
      create policy con_suscripcion_activa on public.%I
        for all to authenticated
        using (negocio_id in (select private.negocios_con_acceso()))
        with check (negocio_id in (select private.negocios_con_acceso()))
    $policy$, tabla);
  end loop;
end $$;

-- Datos operativos: sólo un usuario autenticado, con suscripción vigente,
-- puede leer o escribir. Los grants de escritura omiten `actualizado_en`:
-- el reloj lo fija el default/trigger del servidor y no el navegador.
revoke all on table public.productos, public.ventas, public.venta_items,
  public.clientes, public.fiados, public.fiado_pagos, public.ingresos,
  public.ingreso_items, public.cierres, public.movimientos_caja,
  public.ventas_resumen from public, anon, authenticated;

grant select on table public.productos, public.ventas, public.venta_items,
  public.clientes, public.fiados, public.fiado_pagos, public.ingresos,
  public.ingreso_items, public.cierres, public.movimientos_caja to authenticated;

grant insert (id, negocio_id, codigo_barras, nombre, costo, precio, stock, stock_minimo,
  precio_oferta, oferta_hasta)
  on table public.productos to authenticated;
grant update (id, negocio_id, codigo_barras, nombre, costo, precio, stock, stock_minimo,
  precio_oferta, oferta_hasta, eliminado_en)
  on table public.productos to authenticated;

grant insert (id, negocio_id, fecha, total, medio_pago, cliente_id, estado,
  estado_cobro, referencia_pago, anulada_en, motivo_anulacion)
  on table public.ventas to authenticated;
grant update (id, negocio_id, fecha, total, medio_pago, cliente_id, estado,
  estado_cobro, referencia_pago, anulada_en, motivo_anulacion)
  on table public.ventas to authenticated;

grant insert (id, venta_id, negocio_id, producto_id, nombre, cantidad, precio, costo)
  on table public.venta_items to authenticated;
grant update (id, venta_id, negocio_id, producto_id, nombre, cantidad, precio, costo)
  on table public.venta_items to authenticated;

grant insert (id, negocio_id, nombre, telefono) on table public.clientes to authenticated;
grant update (id, negocio_id, nombre, telefono) on table public.clientes to authenticated;
grant delete on table public.clientes to authenticated;

grant insert (id, negocio_id, cliente_id, venta_id, monto, fecha, vence, anulado_en)
  on table public.fiados to authenticated;
grant update (id, negocio_id, cliente_id, venta_id, monto, fecha, vence, anulado_en)
  on table public.fiados to authenticated;

grant insert (id, negocio_id, fiado_id, monto, fecha)
  on table public.fiado_pagos to authenticated;
grant update (id, negocio_id, fiado_id, monto, fecha)
  on table public.fiado_pagos to authenticated;

grant insert (id, negocio_id, fecha, proveedor, origen) on table public.ingresos to authenticated;
grant update (id, negocio_id, fecha, proveedor, origen) on table public.ingresos to authenticated;

grant insert (id, ingreso_id, negocio_id, producto_id, cantidad, costo_unitario)
  on table public.ingreso_items to authenticated;
grant update (id, ingreso_id, negocio_id, producto_id, cantidad, costo_unitario)
  on table public.ingreso_items to authenticated;

grant insert (id, negocio_id, fecha, fondo_inicial, ventas_efectivo,
  pagos_fiado_efectivo, esperado, contado) on table public.cierres to authenticated;
grant update (id, negocio_id, fecha, fondo_inicial, ventas_efectivo,
  pagos_fiado_efectivo, esperado, contado) on table public.cierres to authenticated;

grant insert (id, negocio_id, fecha, tipo, concepto, monto, medio_pago)
  on table public.movimientos_caja to authenticated;
grant update (id, negocio_id, fecha, tipo, concepto, monto, medio_pago)
  on table public.movimientos_caja to authenticated;
grant delete on table public.movimientos_caja to authenticated;

-- Las cabeceras necesarias para mostrar la cuenta siguen siendo legibles,
-- aun vencida; no habilitan operaciones ni datos del POS.
drop policy if exists solo_mi_negocio on public.negocios;
drop policy if exists leer_mi_negocio on public.negocios;
create policy leer_mi_negocio on public.negocios
  for select to authenticated
  using (id in (select private.negocios_del_usuario()));
alter table public.negocios enable row level security;
revoke all on table public.negocios from public, anon, authenticated;
grant select on table public.negocios to authenticated;

drop policy if exists solo_yo on public.usuarios_negocio;
create policy solo_yo on public.usuarios_negocio
  for select to authenticated
  using (usuario_id = (select auth.uid()));
alter table public.usuarios_negocio enable row level security;
revoke all on table public.usuarios_negocio from public, anon, authenticated;
grant select on table public.usuarios_negocio to authenticated;

drop policy if exists solo_mi_negocio on public.suscripciones;
drop policy if exists leer_mi_suscripcion on public.suscripciones;
create policy leer_mi_suscripcion on public.suscripciones
  for select to authenticated
  using (negocio_id in (select private.negocios_del_usuario()));
alter table public.suscripciones enable row level security;
revoke all on table public.suscripciones from public, anon, authenticated;
grant select on table public.suscripciones to authenticated;

-- Tablas exclusivamente administrativas. La política explícita de DENY deja
-- la intención clara además del revoke y evita falsos positivos del advisor.
drop policy if exists sin_acceso_cliente on public.administradores_plataforma;
create policy sin_acceso_cliente on public.administradores_plataforma
  for all to anon, authenticated
  using (false)
  with check (false);
alter table public.administradores_plataforma enable row level security;
revoke all on table public.administradores_plataforma from public, anon, authenticated;

drop policy if exists sin_acceso_cliente on public.suscripcion_eventos;
create policy sin_acceso_cliente on public.suscripcion_eventos
  for all to anon, authenticated
  using (false)
  with check (false);
alter table public.suscripcion_eventos enable row level security;
revoke all on table public.suscripcion_eventos from public, anon, authenticated;

-- Nunca dejar el helper SECURITY DEFINER público ni ejecutable por un cliente.
-- El bloque también funciona si una instalación ya lo había eliminado.
do $$
begin
  if to_regprocedure('public.negocios_del_usuario()') is not null then
    execute 'revoke all on function public.negocios_del_usuario() from public, anon, authenticated';
    execute 'drop function public.negocios_del_usuario()';
  end if;
end
$$;

-- Los triggers internos no son una API.
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

-- La función de alta queda cerrada en SaaS, pero también se endurece para que
-- una habilitación futura no acepte contenido ilimitado ni un search_path
-- controlable por el llamador.
create or replace function public.crear_mi_negocio(
  p_nombre text,
  p_logo text default null,
  p_color text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio uuid;
  v_existente uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'hay que iniciar sesión';
  end if;
  if pg_catalog.length(coalesce(p_nombre, '')) > 120
     or pg_catalog.length(coalesce(p_logo, '')) > 2000000
     or pg_catalog.length(coalesce(p_color, '')) > 32 then
    raise exception 'los datos del negocio son demasiado grandes';
  end if;

  select negocio_id into v_existente
  from public.usuarios_negocio
  where usuario_id = (select auth.uid())
  limit 1;
  if v_existente is not null then
    return v_existente;
  end if;

  insert into public.negocios (nombre, logo, color)
  values (coalesce(nullif(pg_catalog.trim(p_nombre), ''), 'Mi almacén'), p_logo, p_color)
  returning id into v_negocio;

  insert into public.usuarios_negocio (usuario_id, negocio_id)
  values ((select auth.uid()), v_negocio);
  return v_negocio;
end
$$;
revoke all on function public.crear_mi_negocio(text, text, text) from public, anon, authenticated;

-- El cliente necesita las secuencias de los items generados por bigserial,
-- pero no acceso administrativo sobre ellas.
grant usage, select on sequence public.venta_items_id_seq to authenticated;
grant usage, select on sequence public.ingreso_items_id_seq to authenticated;
grant usage, select on sequence public.ventas_resumen_id_seq to service_role;

-- Índices de todas las FK: además de acelerar listados, evitan bloqueos largos
-- al borrar o actualizar un negocio y mantienen las políticas rápidas.
create index if not exists clientes_negocio_id_idx on public.clientes (negocio_id);
create index if not exists fiados_cliente_id_idx on public.fiados (cliente_id);
create index if not exists fiado_pagos_fiado_id_idx on public.fiado_pagos (fiado_id);
create index if not exists ingreso_items_ingreso_id_idx on public.ingreso_items (ingreso_id);
create index if not exists ingreso_items_negocio_id_idx on public.ingreso_items (negocio_id);
create index if not exists suscripcion_eventos_actor_id_idx on public.suscripcion_eventos (actor_id);
create index if not exists suscripcion_eventos_suscripcion_id_idx on public.suscripcion_eventos (suscripcion_id);
create index if not exists suscripciones_creado_por_idx on public.suscripciones (creado_por);
create index if not exists usuarios_negocio_negocio_id_idx on public.usuarios_negocio (negocio_id);
create index if not exists venta_items_venta_id_idx on public.venta_items (venta_id);
create index if not exists venta_items_venta_negocio_idx on public.venta_items (venta_id, negocio_id);
create index if not exists venta_items_producto_negocio_idx on public.venta_items (producto_id, negocio_id);
create index if not exists ingreso_items_ingreso_negocio_idx on public.ingreso_items (ingreso_id, negocio_id);
create index if not exists ingreso_items_producto_negocio_idx on public.ingreso_items (producto_id, negocio_id);
create index if not exists fiado_pagos_fiado_negocio_idx on public.fiado_pagos (fiado_id, negocio_id);
create index if not exists ventas_cliente_negocio_idx on public.ventas (cliente_id, negocio_id);
create index if not exists fiados_cliente_negocio_idx on public.fiados (cliente_id, negocio_id);
create index if not exists fiados_venta_negocio_idx on public.fiados (venta_id, negocio_id);
create index if not exists suscripcion_eventos_suscripcion_negocio_idx on public.suscripcion_eventos (suscripcion_id, negocio_id);
create index if not exists ventas_resumen_producto_negocio_idx on public.ventas_resumen (producto_id, negocio_id);

-- Integridad entre tenants: un UUID ajeno no se puede enganchar a una fila
-- propia usando sólo un negocio_id inventado.
create unique index if not exists clientes_id_negocio_uidx on public.clientes (id, negocio_id);
create unique index if not exists ventas_id_negocio_uidx on public.ventas (id, negocio_id);
create unique index if not exists fiados_id_negocio_uidx on public.fiados (id, negocio_id);
create unique index if not exists ingresos_id_negocio_uidx on public.ingresos (id, negocio_id);
create unique index if not exists productos_id_negocio_uidx on public.productos (id, negocio_id);
create unique index if not exists suscripciones_id_negocio_uidx on public.suscripciones (id, negocio_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_cliente_negocio_fkey') then
    alter table public.ventas
      add constraint ventas_cliente_negocio_fkey
      foreign key (cliente_id, negocio_id)
      references public.clientes (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fiados_cliente_negocio_fkey') then
    alter table public.fiados
      add constraint fiados_cliente_negocio_fkey
      foreign key (cliente_id, negocio_id)
      references public.clientes (id, negocio_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fiados_venta_negocio_fkey') then
    alter table public.fiados
      add constraint fiados_venta_negocio_fkey
      foreign key (venta_id, negocio_id)
      references public.ventas (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fiado_pagos_fiado_negocio_fkey') then
    alter table public.fiado_pagos
      add constraint fiado_pagos_fiado_negocio_fkey
      foreign key (fiado_id, negocio_id)
      references public.fiados (id, negocio_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_venta_negocio_fkey') then
    alter table public.venta_items
      add constraint venta_items_venta_negocio_fkey
      foreign key (venta_id, negocio_id)
      references public.ventas (id, negocio_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ingreso_items_ingreso_negocio_fkey') then
    alter table public.ingreso_items
      add constraint ingreso_items_ingreso_negocio_fkey
      foreign key (ingreso_id, negocio_id)
      references public.ingresos (id, negocio_id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venta_items_producto_negocio_fkey') then
    alter table public.venta_items
      add constraint venta_items_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ingreso_items_producto_negocio_fkey') then
    alter table public.ingreso_items
      add constraint ingreso_items_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_resumen_producto_negocio_fkey') then
    alter table public.ventas_resumen
      add constraint ventas_resumen_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suscripcion_eventos_suscripcion_negocio_fkey') then
    alter table public.suscripcion_eventos
      add constraint suscripcion_eventos_suscripcion_negocio_fkey
      foreign key (suscripcion_id, negocio_id)
      references public.suscripciones (id, negocio_id);
  end if;
end
$$;

-- Los checks NOT VALID corrigen el futuro sin destruir registros históricos
-- que requieran revisión manual (por ejemplo, stocks negativos antiguos).
do $$
declare
  chequeo record;
begin
  for chequeo in
    select * from (values
      ('productos', 'productos_stock_no_negativo', 'stock >= 0'),
      ('productos', 'productos_stock_minimo_no_negativo', 'stock_minimo >= 0'),
      ('productos', 'productos_costo_no_negativo', 'costo >= 0'),
      ('productos', 'productos_precio_no_negativo', 'precio >= 0'),
      ('productos', 'productos_nombre_no_vacio', 'pg_catalog.length(pg_catalog.btrim(nombre)) > 0'),
      ('productos', 'productos_nombre_largo', 'pg_catalog.length(pg_catalog.btrim(nombre)) between 2 and 160'),
      ('productos', 'productos_codigo_barras_formato', 'codigo_barras is null or codigo_barras ~ ''^[a-zA-Z0-9-]{3,32}$'''),
      ('ventas', 'ventas_total_no_negativo', 'total >= 0'),
      ('ventas', 'ventas_medio_pago_valido', 'medio_pago in (''efectivo'', ''transferencia'', ''qr'', ''fiado'')'),
      ('ventas', 'ventas_estado_valido', 'estado in (''completada'', ''anulada'')'),
      ('ventas', 'ventas_estado_cobro_valido', 'estado_cobro in (''confirmado'', ''pendiente'')'),
      ('venta_items', 'venta_items_cantidad_positiva', 'cantidad > 0'),
      ('venta_items', 'venta_items_importes_validos', 'precio >= 0 and costo >= 0'),
      ('clientes', 'clientes_nombre_no_vacio', 'pg_catalog.length(pg_catalog.btrim(nombre)) > 0'),
      ('clientes', 'clientes_nombre_largo', 'pg_catalog.length(pg_catalog.btrim(nombre)) between 2 and 160'),
      ('fiados', 'fiados_monto_positivo', 'monto > 0'),
      ('fiado_pagos', 'fiado_pagos_monto_positivo', 'monto > 0'),
      ('ingresos', 'ingresos_origen_valido', 'origen in (''manual'', ''foto'')'),
      ('ingreso_items', 'ingreso_items_cantidad_positiva', 'cantidad > 0'),
      ('ingreso_items', 'ingreso_items_costo_no_negativo', 'costo_unitario >= 0'),
      ('movimientos_caja', 'movimientos_caja_monto_positivo', 'monto > 0'),
      ('movimientos_caja', 'movimientos_caja_tipo_valido', 'tipo in (''entrada'', ''salida'')'),
      ('movimientos_caja', 'movimientos_caja_medio_pago_valido', 'medio_pago in (''efectivo'', ''transferencia'', ''qr'')'),
      ('movimientos_caja', 'movimientos_caja_concepto_largo', 'pg_catalog.length(pg_catalog.btrim(concepto)) between 1 and 200'),
      ('cierres', 'cierres_importes_no_negativos', 'fondo_inicial >= 0 and ventas_efectivo >= 0 and pagos_fiado_efectivo >= 0 and esperado >= 0 and contado >= 0')
    ) as t(tabla, nombre, expresion)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', chequeo.tabla)::regclass
        and conname = chequeo.nombre
    ) then
      execute format(
        'alter table public.%I add constraint %I check (%s) not valid',
        chequeo.tabla, chequeo.nombre, chequeo.expresion
      );
    end if;
  end loop;
end
$$;
