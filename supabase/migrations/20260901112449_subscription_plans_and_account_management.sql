-- Centro comercial de Libreta: planes configurables y gestión de cuentas.
-- Se aplica después de migracion-seguridad-plataforma.sql.
-- Es idempotente: no borra clientes ni modifica vencimientos existentes.

create table if not exists public.planes_suscripcion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  tipo text not null default 'pago',
  dias integer not null,
  precio_centavos bigint not null default 0,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (length(btrim(nombre)) between 2 and 80),
  check (descripcion is null or length(descripcion) <= 240),
  check (tipo in ('prueba', 'pago', 'cortesia')),
  check (dias between 1 and 3650),
  check (precio_centavos between 0 and 100000000000),
  check (orden between 0 and 9999)
);

alter table public.negocios
  add column if not exists nota_interna text;

alter table public.suscripciones
  add column if not exists plan_id uuid,
  add column if not exists plan_nombre text,
  add column if not exists importe_centavos bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suscripciones_plan_id_fkey'
  ) then
    alter table public.suscripciones
      add constraint suscripciones_plan_id_fkey
      foreign key (plan_id) references public.planes_suscripcion(id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'suscripciones_importe_centavos_valido'
  ) then
    alter table public.suscripciones
      add constraint suscripciones_importe_centavos_valido
      check (importe_centavos between 0 and 100000000000) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'negocios_nota_interna_larga'
  ) then
    alter table public.negocios
      add constraint negocios_nota_interna_larga
      check (nota_interna is null or length(nota_interna) <= 500) not valid;
  end if;
end
$$;

create index if not exists planes_suscripcion_activos_idx
  on public.planes_suscripcion (activo, orden, nombre);
create index if not exists suscripciones_plan_id_idx
  on public.suscripciones (plan_id);

-- El panel privado usa service_role. Los negocios nunca consultan el catálogo
-- comercial directamente: sólo reciben el nombre/precio que quedó registrado
-- en su propia suscripción.
alter table public.planes_suscripcion enable row level security;
drop policy if exists sin_acceso_cliente on public.planes_suscripcion;
create policy sin_acceso_cliente on public.planes_suscripcion
  for all to anon, authenticated
  using (false)
  with check (false);
revoke all on table public.planes_suscripcion from public, anon, authenticated;

-- Catálogo inicial. Los precios quedan en cero hasta que el propietario los
-- configure; cero significa “precio manual”, nunca un cobro automático.
insert into public.planes_suscripcion
  (codigo, nombre, descripcion, tipo, dias, precio_centavos, activo, orden)
values
  ('prueba-7', 'Prueba gratuita', 'Probá Libreta durante una semana.', 'prueba', 7, 0, true, 10),
  ('mensual-30', 'Mensual', 'Acceso operativo por 30 días.', 'pago', 30, 0, true, 20),
  ('trimestral-90', 'Trimestral', 'Tres meses de acceso operativo.', 'pago', 90, 0, true, 30),
  ('semestral-180', 'Semestral', 'Seis meses de acceso operativo.', 'pago', 180, 0, true, 40),
  ('anual-365', 'Anual', 'Un año de acceso operativo.', 'pago', 365, 0, true, 50),
  ('cortesia-30', 'Cortesía', 'Acceso otorgado sin cobro.', 'cortesia', 30, 0, true, 60)
on conflict (codigo) do nothing;

-- Etiquetamos las suscripciones históricas sin cambiar su estado ni fecha.
update public.suscripciones s
set plan_id = p.id,
    plan_nombre = p.nombre
from public.planes_suscripcion p
where s.plan_id is null
  and p.codigo = case
    when s.tipo = 'prueba' then 'prueba-7'
    when s.tipo = 'cortesia' then 'cortesia-30'
    else 'mensual-30'
  end;

update public.suscripciones
set plan_nombre = case
  when tipo = 'prueba' then 'Prueba gratuita'
  when tipo = 'cortesia' then 'Cortesía'
  when tipo = 'manual' then 'Activación manual'
  else 'Mensual'
end
where plan_nombre is null or length(btrim(plan_nombre)) = 0;

do $$
begin
  if to_regprocedure('public.marca_actualizado()') is not null
     and not exists (
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

