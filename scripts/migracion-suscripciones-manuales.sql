-- Suscripciones manuales de Libreta. Idempotente: se puede ejecutar más de
-- una vez en el proyecto Supabase sin borrar negocios ni movimientos.

alter table negocios add column if not exists telefono_contacto text;

create table if not exists administradores_plataforma (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'propietario' check (rol in ('propietario', 'soporte')),
  creado_en timestamptz not null default now()
);

create table if not exists suscripciones (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null unique references negocios(id) on delete cascade,
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

create table if not exists suscripcion_eventos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  suscripcion_id uuid references suscripciones(id) on delete set null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists suscripciones_estado_vence_idx
  on suscripciones (estado, vence_en);
create index if not exists suscripcion_eventos_negocio_fecha_idx
  on suscripcion_eventos (negocio_id, creado_en desc);

-- El reloj de vencimiento siempre usa el servidor.
do $$
begin
  if to_regprocedure('public.marca_actualizado()') is not null then
    execute 'drop trigger if exists marca_actualizado on suscripciones';
    execute 'create trigger marca_actualizado before update on suscripciones
      for each row execute function public.marca_actualizado()';
  end if;
end $$;

alter table suscripciones enable row level security;
drop policy if exists solo_mi_negocio on suscripciones;
drop policy if exists leer_mi_suscripcion on suscripciones;
-- La política final la crea migracion-seguridad-plataforma.sql con el helper
-- privado. Mientras tanto RLS queda sin una política de lectura, que es el
-- comportamiento seguro para una instalación a medio migrar.
revoke all on table suscripciones from public, anon;
grant select on table suscripciones to authenticated;

-- El navegador nunca puede leer la lista de administradores ni el historial
-- comercial. La función Edge usa la clave de servicio y valida el actor.
alter table administradores_plataforma enable row level security;
alter table suscripcion_eventos enable row level security;
revoke all on table administradores_plataforma from public, anon, authenticated;
revoke all on table suscripcion_eventos from public, anon, authenticated;

-- El vínculo usuario→negocio se crea sólo desde la función administrativa o
-- desde la función de alta controlada. El cliente puede leer su vínculo, pero
-- nunca asociarse por su cuenta a un UUID ajeno.
drop policy if exists solo_yo on usuarios_negocio;
create policy solo_yo on usuarios_negocio for select
  using (usuario_id = auth.uid());
revoke insert, update, delete on table usuarios_negocio from public, anon, authenticated;
grant select on table usuarios_negocio to authenticated;
revoke execute on function public.crear_mi_negocio(text, text, text) from public, anon, authenticated;
