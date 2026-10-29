-- Movimientos de inventario idempotentes. El stock deja de sincronizarse como
-- una foto del producto: cada venta, ingreso o ajuste se aplica una sola vez
-- en el servidor, incluso si dos aparatos trabajan a la vez o se reintenta
-- una subida sin conexión.
create table if not exists public.movimientos_stock (
  id uuid primary key,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  producto_id uuid not null,
  cantidad integer not null check (cantidad <> 0),
  origen text not null check (origen in ('ajuste', 'venta', 'anulacion', 'ingreso')),
  referencia_id uuid,
  creado_en timestamptz not null default pg_catalog.now(),
  foreign key (producto_id, negocio_id) references public.productos(id, negocio_id)
);

create index if not exists movimientos_stock_producto_negocio_idx
  on public.movimientos_stock (producto_id, negocio_id, creado_en desc);

alter table public.movimientos_stock enable row level security;
drop policy if exists leer_movimientos_stock_del_negocio on public.movimientos_stock;
create policy leer_movimientos_stock_del_negocio
  on public.movimientos_stock for select to authenticated
  using (negocio_id in (select private.negocios_con_acceso()));
revoke all on table public.movimientos_stock from public, anon, authenticated;
grant select on table public.movimientos_stock to authenticated;

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
security definer
set search_path = ''
as $$
declare
  v_stock integer;
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

  update public.productos
  set stock = stock + p_cantidad
  where id = p_producto_id
    and negocio_id = p_negocio_id
    and eliminado_en is null
    and stock + p_cantidad >= 0
  returning stock into v_stock;

  if not found then
    raise exception 'stock insuficiente o producto inexistente';
  end if;
  return v_stock;
end
$$;
revoke all on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid) to authenticated;

-- Pedidos ya se bajan por cursor; sumar su publicación hace que el otro
-- aparato reciba el aviso inmediato y no tenga que esperar el intervalo.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
  alter table public.pedidos replica identity full;
end
$$;
