-- Mejora #19: el cliente ve su cuenta (sólo lectura) con un link.
-- El dueño crea un token largo y aleatorio por cliente; quien tiene el link
-- ve el saldo y los últimos movimientos de ESE cliente, nada más. El dueño
-- puede dejar de compartirlo (revocado_en). Aditiva.

create table if not exists public.cuentas_compartidas (
  token text primary key check (token ~ '^[0-9a-f]{48,128}$'),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  cliente_id uuid not null,
  creado_en timestamptz not null default now(),
  revocado_en timestamptz
);
create index if not exists cuentas_compartidas_cliente on public.cuentas_compartidas (negocio_id, cliente_id);
alter table public.cuentas_compartidas enable row level security;
alter table public.cuentas_compartidas force row level security;
grant select, insert on table public.cuentas_compartidas to authenticated;
grant update (revocado_en) on table public.cuentas_compartidas to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cuentas_compartidas' and policyname = 'dueno_ve_sus_links') then
    create policy dueno_ve_sus_links on public.cuentas_compartidas for select to authenticated using ((select private.es_dueno(negocio_id)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cuentas_compartidas' and policyname = 'dueno_crea_links') then
    create policy dueno_crea_links on public.cuentas_compartidas for insert to authenticated
      with check ((select private.es_dueno(negocio_id)) and revocado_en is null
        and exists (select 1 from public.clientes c where c.id = cliente_id and c.negocio_id = cuentas_compartidas.negocio_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cuentas_compartidas' and policyname = 'dueno_revoca_links') then
    create policy dueno_revoca_links on public.cuentas_compartidas for update to authenticated
      using ((select private.es_dueno(negocio_id))) with check ((select private.es_dueno(negocio_id)));
  end if;
end $$;

-- Lo único que ve quien abre el link. Sin token válido, null.
create or replace function public.cuenta_cliente(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.cuentas_compartidas%rowtype;
  v_resultado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48,128}$' then return null; end if;
  select * into v_link from public.cuentas_compartidas where token = p_token and revocado_en is null;
  if not found then return null; end if;

  with fiados as (
    select f.id, f.fecha, f.monto, f.venta_id
    from public.fiados f
    where f.negocio_id = v_link.negocio_id and f.cliente_id = v_link.cliente_id and f.anulado_en is null
  ), pagos as (
    select p.fecha, p.monto
    from public.fiado_pagos p
    join fiados f on f.id = p.fiado_id
  )
  select jsonb_build_object(
    'negocio', (select n.nombre from public.negocios n where n.id = v_link.negocio_id),
    'cliente', (select c.nombre from public.clientes c where c.id = v_link.cliente_id and c.negocio_id = v_link.negocio_id),
    'saldo', coalesce((select sum(monto) from fiados), 0) - coalesce((select sum(monto) from pagos), 0),
    'fiados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fecha', x.fecha,
        'monto', x.monto,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('nombre', vi.nombre, 'cantidad', vi.cantidad) order by vi.posicion)
          from public.venta_items vi
          where vi.venta_id = x.venta_id and vi.negocio_id = v_link.negocio_id
        ), '[]'::jsonb)
      ) order by x.fecha desc)
      from (select * from fiados order by fecha desc limit 40) x
    ), '[]'::jsonb),
    'pagos', coalesce((select jsonb_agg(jsonb_build_object('fecha', y.fecha, 'monto', y.monto) order by y.fecha desc) from (select * from pagos order by fecha desc limit 40) y), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end
$$;
grant execute on function public.cuenta_cliente(text) to anon, authenticated;
