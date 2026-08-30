-- Migración inicial de Libreta. Ejecutar en el editor SQL de Supabase.

create table negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo text,
  color text,
  plan text not null default 'gratis',
  dominio text unique,
  creado_en timestamptz not null default now()
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
  actualizado_en timestamptz not null default now()
);

create table ventas (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  total bigint not null,
  medio_pago text not null,
  cliente_id uuid
);

create table venta_items (
  id bigserial primary key,
  venta_id uuid not null references ventas(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  nombre text not null,
  cantidad integer not null,
  precio bigint not null,
  costo bigint not null
);

create table clientes (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  telefono text
);

create table fiados (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  venta_id uuid,
  monto bigint not null,
  fecha timestamptz not null,
  vence timestamptz
);

create table fiado_pagos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fiado_id uuid not null references fiados(id) on delete cascade,
  monto bigint not null,
  fecha timestamptz not null
);

create table ingresos (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  proveedor text,
  origen text not null default 'manual'
);

create table ingreso_items (
  id bigserial primary key,
  ingreso_id uuid not null references ingresos(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  producto_id uuid not null,
  cantidad integer not null,
  costo_unitario bigint not null
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
create index on ventas (negocio_id, fecha desc);
create index on venta_items (negocio_id, producto_id);
create index on fiados (negocio_id, cliente_id);
create index on fiado_pagos (negocio_id, fiado_id);
create index on ingresos (negocio_id, fecha desc);

-- RLS: el aislamiento vive en la base, no en la confianza en el código.
-- Aunque una consulta olvide su WHERE, Postgres no devuelve filas ajenas.
create or replace function negocios_del_usuario()
returns setof uuid
language sql stable security definer
as $$
  select negocio_id from usuarios_negocio where usuario_id = auth.uid()
$$;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','ventas','venta_items','clientes','fiados',
    'fiado_pagos','ingresos','ingreso_items','ventas_resumen'
  ] loop
    execute format('alter table %I enable row level security', tabla);
    execute format(
      'create policy solo_mi_negocio on %I for all
         using (negocio_id in (select negocios_del_usuario()))
         with check (negocio_id in (select negocios_del_usuario()))',
      tabla
    );
  end loop;
end $$;

alter table negocios enable row level security;
create policy solo_mi_negocio on negocios for all
  using (id in (select negocios_del_usuario()))
  with check (id in (select negocios_del_usuario()));

alter table usuarios_negocio enable row level security;
create policy solo_yo on usuarios_negocio for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
