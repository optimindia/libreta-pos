-- Migración inicial de Libreta. Ejecutar en el editor SQL de Supabase.

create table negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo text,
  color text,
  plan text not null default 'gratis',
  dominio text unique,
  telefono_contacto text,
  nota_interna text,
  creado_en timestamptz not null default now()
);

-- Preferencias visibles del negocio. Se mantiene separada de `negocios` para
-- que el cliente nunca pueda modificar notas internas, plan o dominio.
create table negocio_configuracion (
  negocio_id uuid primary key references negocios(id) on delete cascade,
  funciones jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  check (jsonb_typeof(funciones) = 'object'),
  check (octet_length(funciones::text) <= 10000)
);

create table usuarios_negocio (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  primary key (usuario_id, negocio_id)
);

create table productos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  codigo_barras text,
  nombre text not null,
  costo bigint not null default 0,
  precio bigint not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 0,
  precio_oferta bigint,
  oferta_hasta timestamptz,
  eliminado_en timestamptz,
  actualizado_en timestamptz not null default now(),
  check (length(btrim(nombre)) between 2 and 160),
  check (codigo_barras is null or codigo_barras ~ '^[a-zA-Z0-9-]{3,32}$'),
  check (costo >= 0 and precio >= 0 and stock >= 0 and stock_minimo >= 0),
  check (precio_oferta is null or (precio_oferta > 0 and precio_oferta < precio)),
  check (oferta_hasta is null or precio_oferta is not null)
);

create table movimientos_stock (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  cantidad integer not null check (cantidad <> 0),
  origen text not null check (origen in ('ajuste', 'venta', 'anulacion', 'ingreso')),
  referencia_id uuid,
  creado_en timestamptz not null default now()
);

create table ventas (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  total bigint not null,
  medio_pago text not null,
  cliente_id uuid,
  estado text not null default 'completada',
  estado_cobro text not null default 'confirmado',
  referencia_pago text,
  pedido_id uuid,
  anulada_en timestamptz,
  motivo_anulacion text,
  actualizado_en timestamptz not null default now(),
  check (total >= 0),
  check (medio_pago in ('efectivo', 'transferencia', 'qr', 'fiado')),
  check (estado in ('completada', 'anulada')),
  check (estado_cobro in ('confirmado', 'pendiente'))
);

create table venta_items (
  id bigserial primary key,
  venta_id uuid not null references ventas(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  nombre text not null,
  cantidad integer not null,
  precio bigint not null,
  costo bigint not null,
  check (cantidad > 0 and precio >= 0 and costo >= 0)
);

create table pedidos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  actualizado_en timestamptz not null default now(),
  estado text not null default 'pendiente',
  cliente_id uuid,
  total bigint not null,
  tipo_entrega text not null default 'retiro',
  fecha_entrega timestamptz,
  direccion text,
  nota text,
  reservar_stock boolean not null default false,
  venta_id uuid,
  check (estado in ('pendiente', 'preparando', 'listo', 'entregado', 'cancelado')),
  check (total >= 0),
  check (tipo_entrega in ('retiro', 'envio')),
  check (tipo_entrega = 'retiro' or length(btrim(coalesce(direccion, ''))) between 3 and 240),
  check (nota is null or length(nota) <= 500)
);

create table pedido_items (
  id bigserial primary key,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  nombre text not null,
  cantidad integer not null,
  precio bigint not null,
  costo bigint not null,
  check (cantidad > 0 and precio >= 0 and costo >= 0)
);

create table clientes (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  telefono text,
  actualizado_en timestamptz not null default now(),
  check (length(btrim(nombre)) between 2 and 160)
);

create table fiados (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  venta_id uuid,
  monto bigint not null,
  fecha timestamptz not null,
  vence timestamptz,
  anulado_en timestamptz,
  actualizado_en timestamptz not null default now(),
  check (monto > 0)
);

create table fiado_pagos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fiado_id uuid not null references fiados(id) on delete cascade,
  monto bigint not null,
  fecha timestamptz not null,
  actualizado_en timestamptz not null default now(),
  check (monto > 0)
);

create table ingresos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  proveedor text,
  origen text not null default 'manual',
  actualizado_en timestamptz not null default now(),
  check (origen in ('manual', 'foto'))
);

create table ingreso_items (
  id bigserial primary key,
  ingreso_id uuid not null references ingresos(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  cantidad integer not null,
  costo_unitario bigint not null,
  check (cantidad > 0 and costo_unitario >= 0)
);

create table cierres (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  fondo_inicial bigint not null,
  ventas_efectivo bigint not null,
  pagos_fiado_efectivo bigint not null,
  esperado bigint not null,
  contado bigint not null,
  actualizado_en timestamptz not null default now(),
  check (fondo_inicial >= 0 and ventas_efectivo >= 0 and pagos_fiado_efectivo >= 0 and esperado >= 0 and contado >= 0)
);

create table movimientos_caja (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  tipo text not null,
  concepto text not null,
  monto bigint not null,
  medio_pago text not null,
  actualizado_en timestamptz not null default now(),
  check (tipo in ('entrada', 'salida') and medio_pago in ('efectivo', 'transferencia', 'qr') and monto > 0)
);

-- Suscripciones manuales: el estado comercial vive separado del negocio y
-- se consulta desde el cliente sólo para el negocio del usuario. Las altas,
-- extensiones y suspensiones las hace el panel privado mediante la función
-- administrativa de Supabase.
create table planes_suscripcion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  tipo text not null default 'pago' check (tipo in ('prueba', 'pago', 'cortesia')),
  dias integer not null check (dias between 1 and 3650),
  precio_centavos bigint not null default 0 check (precio_centavos between 0 and 100000000000),
  activo boolean not null default true,
  orden integer not null default 0 check (orden between 0 and 9999),
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (length(btrim(nombre)) between 2 and 80),
  check (descripcion is null or length(descripcion) <= 240)
);

create table suscripciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references negocios(id) on delete cascade,
  plan_id uuid references planes_suscripcion(id) on delete set null,
  plan_nombre text,
  importe_centavos bigint not null default 0 check (importe_centavos between 0 and 100000000000),
  estado text not null check (estado in ('prueba', 'activa', 'gracia', 'suspendida')),
  tipo text not null check (tipo in ('prueba', 'mensual', 'cortesia', 'manual')),
  inicio_en timestamptz not null,
  vence_en timestamptz not null,
  gracia_hasta timestamptz,
  nota text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (gracia_hasta is null or gracia_hasta >= vence_en)
);

create table administradores_plataforma (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'propietario' check (rol in ('propietario', 'soporte')),
  creado_en timestamptz not null default now()
);

create table suscripcion_eventos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  suscripcion_id uuid references suscripciones(id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create table ventas_resumen (
  id bigserial primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  dia date not null,
  producto_id uuid not null,
  unidades integer not null,
  vendido bigint not null,
  ganancia bigint not null,
  unique (negocio_id, dia, producto_id)
);

-- Toda consulta filtra primero por negocio: es la diferencia entre
-- milisegundos y minutos cuando haya cien clientes adentro.
create index on productos (negocio_id, codigo_barras);
create index on productos (negocio_id, nombre);
create index on productos (negocio_id, oferta_hasta);
create index on productos (negocio_id, eliminado_en);
create index on ventas (negocio_id, fecha desc);
create index on ventas (negocio_id, pedido_id);
create index on venta_items (negocio_id, producto_id);
create index on fiados (negocio_id, cliente_id);
create index on fiado_pagos (negocio_id, fiado_id);
create index on ingresos (negocio_id, fecha desc);
create index on cierres (negocio_id, fecha desc);
create index on movimientos_caja (negocio_id, fecha desc);
create index on suscripciones (estado, vence_en);
create index on suscripciones (plan_id);
create index on planes_suscripcion (activo, orden, nombre);
create index on planes_suscripcion (creado_por);
create index on suscripcion_eventos (negocio_id, creado_en desc);
create index on venta_items (producto_id, negocio_id);
create index on ingreso_items (producto_id, negocio_id);
create index on suscripcion_eventos (suscripcion_id, negocio_id);
create index on ventas_resumen (producto_id, negocio_id);
create index on pedidos (negocio_id, fecha desc);
create index on pedidos (negocio_id, estado, fecha_entrega);
create index on pedidos (cliente_id, negocio_id);
create index on pedido_items (negocio_id, pedido_id);
create index on pedido_items (pedido_id);
create index on pedido_items (pedido_id, negocio_id);
create index on pedido_items (producto_id, negocio_id);
create index on negocio_configuracion (actualizado_en);

-- RLS: el aislamiento vive en la base, no en la confianza en el código.
-- Los helpers están fuera de `public` y con search_path fijo: no son RPCs
-- para el navegador y no pueden convertirse en una puerta lateral.
create schema if not exists private;

create or replace function private.negocios_del_usuario()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select negocio_id
  from public.usuarios_negocio
  where usuario_id = (select auth.uid())
$$;

create or replace function private.negocios_con_acceso()
returns setof uuid
language sql stable security definer
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

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','movimientos_stock','ventas','venta_items','pedidos','pedido_items','clientes','fiados',
    'fiado_pagos','ingresos','ingreso_items','ventas_resumen','cierres','movimientos_caja',
    'negocio_configuracion'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('revoke all on table public.%I from public, anon, authenticated', tabla);
    execute format('grant select, insert, update on table public.%I to authenticated', tabla);
    execute format($policy$
      create policy con_suscripcion_activa on public.%I for all to authenticated
        using (negocio_id in (select private.negocios_con_acceso()))
        with check (negocio_id in (select private.negocios_con_acceso()))
    $policy$, tabla);
  end loop;
end $$;

-- La aplicación puede quitar clientes sin historial. La política RLS de la
-- tabla sigue limitando el borrado al negocio de la sesión autenticada.
grant delete on table public.clientes to authenticated;

revoke all on table public.movimientos_caja from public, anon, authenticated;
grant select, insert, update, delete on table public.movimientos_caja to authenticated;
revoke all on table public.movimientos_stock from public, anon, authenticated;
grant select, insert on table public.movimientos_stock to authenticated;
revoke all on table public.ventas_resumen from public, anon, authenticated;
revoke all on table public.negocio_configuracion from public, anon, authenticated;
grant select on table public.negocio_configuracion to authenticated;
grant insert (negocio_id, funciones, actualizado_en) on table public.negocio_configuracion to authenticated;
grant update (negocio_id, funciones, actualizado_en) on table public.negocio_configuracion to authenticated;

alter table public.negocios enable row level security;
drop policy if exists solo_mi_negocio on public.negocios;
create policy leer_mi_negocio on public.negocios for select to authenticated
  using (id in (select private.negocios_del_usuario()));
revoke all on table public.negocios from public, anon, authenticated;
grant select on table public.negocios to authenticated;

alter table public.usuarios_negocio enable row level security;
drop policy if exists solo_yo on public.usuarios_negocio;
create policy solo_yo on public.usuarios_negocio for select to authenticated
  using (usuario_id = (select auth.uid()));
revoke all on table public.usuarios_negocio from public, anon, authenticated;
grant select on table public.usuarios_negocio to authenticated;

alter table public.suscripciones enable row level security;
drop policy if exists solo_mi_negocio on public.suscripciones;
create policy leer_mi_suscripcion on public.suscripciones for select to authenticated
  using (negocio_id in (select private.negocios_del_usuario()));
revoke all on table public.suscripciones from public, anon, authenticated;
grant select on table public.suscripciones to authenticated;

alter table public.planes_suscripcion enable row level security;
drop policy if exists sin_acceso_cliente on public.planes_suscripcion;
create policy sin_acceso_cliente on public.planes_suscripcion
  for all to anon, authenticated using (false) with check (false);
revoke all on table public.planes_suscripcion from public, anon, authenticated;

-- El cliente nunca lee ni escribe la lista de administradores o el historial.
alter table public.administradores_plataforma enable row level security;
drop policy if exists sin_acceso_cliente on public.administradores_plataforma;
create policy sin_acceso_cliente on public.administradores_plataforma
  for all to anon, authenticated using (false) with check (false);
revoke all on table public.administradores_plataforma from public, anon, authenticated;

alter table public.suscripcion_eventos enable row level security;
drop policy if exists sin_acceso_cliente on public.suscripcion_eventos;
create policy sin_acceso_cliente on public.suscripcion_eventos
  for all to anon, authenticated using (false) with check (false);
revoke all on table public.suscripcion_eventos from public, anon, authenticated;

-- No quedan funciones de autorización en public ni altas autónomas desde el
-- navegador: las cuentas las crea el panel Edge del propietario.
drop function if exists public.negocios_del_usuario();
revoke all on function public.crear_mi_negocio(text, text, text) from public, anon, authenticated;
drop function if exists public.marca_actualizado();
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

  insert into public.movimientos_stock (id, negocio_id, producto_id, cantidad, origen, referencia_id)
  values (p_movimiento_id, p_negocio_id, p_producto_id, p_cantidad, p_origen, p_referencia_id)
  on conflict (id) do nothing;
  if not found then
    select stock into v_stock from public.productos where id = p_producto_id and negocio_id = p_negocio_id;
    return v_stock;
  end if;

  update public.productos
  set stock = stock + p_cantidad
  where id = p_producto_id and negocio_id = p_negocio_id and eliminado_en is null and stock + p_cantidad >= 0
  returning stock into v_stock;
  if not found then raise exception 'stock insuficiente o producto inexistente'; end if;
  return v_stock;
end
$$;
revoke all on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.planes_suscripcion'::regclass
      and tgname = 'planes_suscripcion_marca_actualizado'
  ) then
    create trigger planes_suscripcion_marca_actualizado
      before update on public.planes_suscripcion
      for each row execute function public.marca_actualizado();
  end if;
end
$$;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos', 'ventas', 'clientes', 'fiados', 'fiado_pagos',
    'ingresos', 'cierres', 'movimientos_caja', 'pedidos', 'suscripciones'
  ] loop
    execute format('create trigger marca_actualizado before update on public.%I for each row execute function public.marca_actualizado()', tabla);
  end loop;
end
$$;

drop trigger if exists negocio_configuracion_marca_actualizado on public.negocio_configuracion;
create trigger negocio_configuracion_marca_actualizado
  before insert or update on public.negocio_configuracion
  for each row execute function public.marca_actualizado();

-- Se conserva por compatibilidad de esquema, pero el alta queda cerrada al
-- cliente. El panel administrativo usa la clave de servicio de la Edge.
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
  if (select auth.uid()) is null then raise exception 'hay que iniciar sesión'; end if;
  if pg_catalog.length(coalesce(p_nombre, '')) > 120
     or pg_catalog.length(coalesce(p_logo, '')) > 2000000
     or pg_catalog.length(coalesce(p_color, '')) > 32 then
    raise exception 'los datos del negocio son demasiado grandes';
  end if;
  select negocio_id into v_existente
  from public.usuarios_negocio
  where usuario_id = (select auth.uid())
  limit 1;
  if v_existente is not null then return v_existente; end if;
  insert into public.negocios (nombre, logo, color)
  values (coalesce(nullif(pg_catalog.trim(p_nombre), ''), 'Mi almacén'), p_logo, p_color)
  returning id into v_negocio;
  insert into public.usuarios_negocio (usuario_id, negocio_id)
  values ((select auth.uid()), v_negocio);
  return v_negocio;
end
$$;
revoke all on function public.crear_mi_negocio(text, text, text) from public, anon, authenticated;

-- El navegador necesita sólo las secuencias de items que inserta.
grant usage, select on sequence public.venta_items_id_seq to authenticated;
grant usage, select on sequence public.ingreso_items_id_seq to authenticated;

-- Relaciones compuestas: un UUID conocido de otro negocio no alcanza para
-- enganchar un item, una deuda o un evento a una cabecera ajena.
create unique index productos_id_negocio_uidx on public.productos (id, negocio_id);
create unique index clientes_id_negocio_uidx on public.clientes (id, negocio_id);
create unique index ventas_id_negocio_uidx on public.ventas (id, negocio_id);
create unique index fiados_id_negocio_uidx on public.fiados (id, negocio_id);
create unique index ingresos_id_negocio_uidx on public.ingresos (id, negocio_id);
create unique index pedidos_id_negocio_uidx on public.pedidos (id, negocio_id);
create unique index suscripciones_id_negocio_uidx on public.suscripciones (id, negocio_id);

alter table public.ventas add constraint ventas_cliente_negocio_fkey
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id);
alter table public.fiados add constraint fiados_cliente_negocio_fkey
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id) on delete cascade;
alter table public.fiados add constraint fiados_venta_negocio_fkey
  foreign key (venta_id, negocio_id) references public.ventas (id, negocio_id);
alter table public.fiado_pagos add constraint fiado_pagos_fiado_negocio_fkey
  foreign key (fiado_id, negocio_id) references public.fiados (id, negocio_id) on delete cascade;
alter table public.venta_items add constraint venta_items_venta_negocio_fkey
  foreign key (venta_id, negocio_id) references public.ventas (id, negocio_id) on delete cascade;
alter table public.ingreso_items add constraint ingreso_items_ingreso_negocio_fkey
  foreign key (ingreso_id, negocio_id) references public.ingresos (id, negocio_id) on delete cascade;
alter table public.venta_items add constraint venta_items_producto_negocio_fkey
  foreign key (producto_id, negocio_id) references public.productos (id, negocio_id);
alter table public.ventas add constraint ventas_pedido_negocio_fkey
  foreign key (pedido_id, negocio_id) references public.pedidos (id, negocio_id);
alter table public.pedidos add constraint pedidos_cliente_negocio_fkey
  foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id);
alter table public.pedido_items add constraint pedido_items_pedido_negocio_fkey
  foreign key (pedido_id, negocio_id) references public.pedidos (id, negocio_id) on delete cascade;
alter table public.pedido_items add constraint pedido_items_producto_negocio_fkey
  foreign key (producto_id, negocio_id) references public.productos (id, negocio_id);
alter table public.ingreso_items add constraint ingreso_items_producto_negocio_fkey
  foreign key (producto_id, negocio_id) references public.productos (id, negocio_id);
alter table public.ventas_resumen add constraint ventas_resumen_producto_negocio_fkey
  foreign key (producto_id, negocio_id) references public.productos (id, negocio_id);
alter table public.suscripcion_eventos add constraint suscripcion_eventos_suscripcion_negocio_fkey
  foreign key (suscripcion_id, negocio_id) references public.suscripciones (id, negocio_id);
