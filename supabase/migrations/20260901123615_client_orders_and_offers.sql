-- Funciones para el negocio: pedidos, reservas de stock y ofertas.
-- Ejecutar después de la migración de seguridad de la plataforma.

alter table public.productos add column if not exists precio_oferta bigint;
alter table public.productos add column if not exists oferta_hasta timestamptz;
alter table public.ventas add column if not exists pedido_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_oferta_valida_chk') then
    alter table public.productos add constraint productos_oferta_valida_chk
      check (precio_oferta is null or (precio_oferta > 0 and precio_oferta < precio));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'productos_oferta_fecha_chk') then
    alter table public.productos add constraint productos_oferta_fecha_chk
      check (oferta_hasta is null or precio_oferta is not null);
  end if;
end $$;

create table if not exists public.pedidos (
  id uuid primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
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

create table if not exists public.pedido_items (
  id bigserial primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  producto_id uuid not null,
  nombre text not null,
  cantidad integer not null,
  precio bigint not null,
  costo bigint not null,
  check (cantidad > 0 and precio >= 0 and costo >= 0)
);

create index if not exists productos_negocio_oferta_hasta_idx on public.productos (negocio_id, oferta_hasta);
create index if not exists ventas_negocio_pedido_idx on public.ventas (negocio_id, pedido_id);
create index if not exists pedidos_negocio_fecha_idx on public.pedidos (negocio_id, fecha desc);
create index if not exists pedidos_negocio_estado_entrega_idx on public.pedidos (negocio_id, estado, fecha_entrega);
create index if not exists pedidos_negocio_cliente_idx on public.pedidos (negocio_id, cliente_id);
create index if not exists pedido_items_negocio_pedido_idx on public.pedido_items (negocio_id, pedido_id);
create index if not exists pedido_items_producto_negocio_idx on public.pedido_items (producto_id, negocio_id);
create unique index if not exists pedidos_id_negocio_uidx on public.pedidos (id, negocio_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_pedido_negocio_fkey') then
    alter table public.ventas add constraint ventas_pedido_negocio_fkey
      foreign key (pedido_id, negocio_id) references public.pedidos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedidos_cliente_negocio_fkey') then
    alter table public.pedidos add constraint pedidos_cliente_negocio_fkey
      foreign key (cliente_id, negocio_id) references public.clientes (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedido_items_pedido_negocio_fkey') then
    alter table public.pedido_items add constraint pedido_items_pedido_negocio_fkey
      foreign key (pedido_id, negocio_id) references public.pedidos (id, negocio_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pedido_items_producto_negocio_fkey') then
    alter table public.pedido_items add constraint pedido_items_producto_negocio_fkey
      foreign key (producto_id, negocio_id) references public.productos (id, negocio_id);
  end if;
end $$;

alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
revoke all on table public.pedidos, public.pedido_items from public, anon, authenticated;
grant select, insert, update on table public.pedidos, public.pedido_items to authenticated;
drop policy if exists con_suscripcion_activa on public.pedidos;
create policy con_suscripcion_activa on public.pedidos for all to authenticated
  using (negocio_id in (select private.negocios_con_acceso()))
  with check (negocio_id in (select private.negocios_con_acceso()));
drop policy if exists con_suscripcion_activa on public.pedido_items;
create policy con_suscripcion_activa on public.pedido_items for all to authenticated
  using (negocio_id in (select private.negocios_con_acceso()))
  with check (negocio_id in (select private.negocios_con_acceso()));

grant usage, select on sequence public.pedido_items_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.pedidos'::regclass and tgname = 'pedidos_marca_actualizado'
  ) then
    create trigger pedidos_marca_actualizado
      before update on public.pedidos
      for each row execute function public.marca_actualizado();
  end if;
end $$;
