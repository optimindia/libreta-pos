-- Venta por kilo o por litro: las cantidades y el stock aceptan decimales
-- (hasta milésimas: gramos o mililitros) y cada producto dice cómo se vende.
-- Los valores enteros existentes se conservan tal cual.

alter table public.productos
  alter column stock type numeric(14, 3),
  alter column stock_minimo type numeric(14, 3),
  add column if not exists unidad text not null default 'unidad';

alter table public.productos
  drop constraint if exists productos_unidad_valida,
  add constraint productos_unidad_valida check (unidad in ('unidad', 'kg', 'l'));

alter table public.venta_items alter column cantidad type numeric(14, 3);
alter table public.pedido_items alter column cantidad type numeric(14, 3);
alter table public.ingreso_items alter column cantidad type numeric(14, 3);
alter table public.movimientos_stock alter column cantidad type numeric(14, 3);

-- La función de movimientos pasa a recibir y devolver cantidades decimales.
drop function if exists public.registrar_movimiento_stock(uuid, uuid, uuid, integer, text, uuid);

create function public.registrar_movimiento_stock(
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

revoke all on function public.registrar_movimiento_stock(uuid, uuid, uuid, numeric, text, uuid) from public;
grant execute on function public.registrar_movimiento_stock(uuid, uuid, uuid, numeric, text, uuid) to authenticated, service_role;
