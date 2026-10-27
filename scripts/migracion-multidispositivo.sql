-- Migración de multi-dispositivo. Idempotente: se puede ejecutar muchas veces.
-- Ejecutar en el editor SQL del proyecto Supabase "Libreta" (wfouklntgkjzcqtmwuou).
-- Después correr: npm run verificar:aislamiento

-- 1) La marca de actualización: sólo productos la tenía. El cursor de la
--    bajada incremental la necesita en cada tabla sincronizada.
alter table ventas       add column if not exists actualizado_en timestamptz not null default now();
alter table clientes     add column if not exists actualizado_en timestamptz not null default now();
alter table fiados       add column if not exists actualizado_en timestamptz not null default now();
alter table fiado_pagos  add column if not exists actualizado_en timestamptz not null default now();
alter table ingresos     add column if not exists actualizado_en timestamptz not null default now();
alter table cierres      add column if not exists actualizado_en timestamptz not null default now();
alter table ventas       add column if not exists estado text not null default 'completada';
alter table ventas       add column if not exists estado_cobro text not null default 'confirmado';
alter table ventas       add column if not exists referencia_pago text;
alter table ventas       add column if not exists anulada_en timestamptz;
alter table ventas       add column if not exists motivo_anulacion text;
alter table fiados       add column if not exists anulado_en timestamptz;
-- venta_items e ingreso_items no: bajan siempre junto a su cabecera.
-- ventas_resumen no se sincroniza.

create table if not exists movimientos_caja (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  tipo text not null,
  concepto text not null,
  monto bigint not null,
  medio_pago text not null,
  actualizado_en timestamptz not null default now()
);
alter table movimientos_caja add column if not exists actualizado_en timestamptz not null default now();
create index if not exists movimientos_caja_negocio_id_fecha_idx on movimientos_caja (negocio_id, fecha desc);

-- 2) Un solo reloj: el del servidor. El cliente deja de mandar su propia
--    marca; en INSERT aplica el default y en UPDATE este trigger.
create or replace function marca_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en = pg_catalog.now();
  return new;
end $$;
revoke all on function public.marca_actualizado() from public, anon, authenticated;

do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','ventas','clientes','fiados','fiado_pagos','ingresos','cierres','movimientos_caja'
  ] loop
    execute format('drop trigger if exists marca_actualizado on %I', tabla);
    execute format(
      'create trigger marca_actualizado before update on %I
         for each row execute function public.marca_actualizado()', tabla);
  end loop;
end $$;

-- La tabla nueva debe quedar aislada por negocio igual que las demás.
alter table movimientos_caja enable row level security;
drop policy if exists solo_mi_negocio on movimientos_caja;
drop policy if exists con_suscripcion_activa on movimientos_caja;
-- La política final la crea migracion-seguridad-plataforma.sql con el helper
-- privado. Sin ella, RLS no permite operar mientras se completa la migración.

-- 3) Realtime: emitir cambios de las tablas del negocio. REPLICA IDENTITY
--    FULL es lo que hace que el evento llegue con la fila completa y que
--    el RLS pueda filtrar qué se le envía a cada usuario.
do $$
declare tabla text;
begin
  foreach tabla in array array[
    'productos','ventas','clientes','fiados','fiado_pagos','ingresos','cierres','movimientos_caja'
  ] loop
    -- add table no es idempotente por sí solo: si la tabla ya está en la
    -- publicación, lanza error. El chequeo lo vuelve ejecutable N veces.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = tabla
    ) then
      execute format('alter publication supabase_realtime add table %I', tabla);
    end if;
    execute format('alter table %I replica identity full', tabla);
  end loop;
end $$;
