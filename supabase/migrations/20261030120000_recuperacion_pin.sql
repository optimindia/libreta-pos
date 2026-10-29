-- SEG-04: recuperación segura del PIN.
-- ADITIVA y REVERSIBLE (el SQL para revertir está comentado al final).
-- NO se aplica sola: hay que correrla a mano, antes de desplegar las funciones
-- `admin` e `ingresar` nuevas (pasos en docs/nube.md).
--
-- Qué agrega:
--   1. public.recuperacion_pin_codigos: el hash del código de recuperación del
--      dueño (un código vigente por usuario, de un solo uso). Sólo service
--      role: el navegador no puede leerla ni escribirla.
--   2. usuarios_negocio.debe_cambiar_pin: marca que el usuario entró con un PIN
--      temporal y tiene que elegir uno propio. El usuario puede LEER su propia
--      marca (ya puede leer su fila, política solo_yo) pero no cambiarla: la
--      baja sólo la hace la función Edge cuando el PIN se cambia de verdad.
--
-- Los límites de intentos reutilizan public.intentos_ingreso (SEG-03) con
-- claves propias (`reset:<usuario>`, `pin:<usuario>`, `recuperar:<teléfono>`):
-- no hace falta ninguna tabla más, y trabar una de ellas no traba el ingreso.
-- La auditoría reutiliza public.suscripcion_eventos (sólo service role).

create table if not exists public.recuperacion_pin_codigos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  -- HMAC del código; el código en sí nunca se guarda.
  codigo_hash text not null,
  creado_en timestamptz not null default now(),
  -- null = vigente. Se marca con un UPDATE condicional, así dos pedidos a la
  -- vez con el mismo código no pueden ganar los dos.
  usado_en timestamptz
);

comment on table public.recuperacion_pin_codigos is
  'Hash del código de recuperación de PIN del dueño (SEG-04). Sólo service role.';

-- RLS cerrada por defecto: sin políticas y sin permisos para el navegador.
alter table public.recuperacion_pin_codigos enable row level security;
alter table public.recuperacion_pin_codigos force row level security;

revoke all on table public.recuperacion_pin_codigos from public, anon, authenticated;
grant select, insert, update, delete on table public.recuperacion_pin_codigos to service_role;

alter table public.usuarios_negocio
  add column if not exists debe_cambiar_pin boolean not null default false;

comment on column public.usuarios_negocio.debe_cambiar_pin is
  'true = entró con un PIN temporal y debe elegir uno propio (SEG-04). Sólo la función Edge lo baja.';

-- ---------------------------------------------------------------------------
-- Para revertir (ejecutar a mano; se pierden los códigos de recuperación y las
-- marcas de cambio pendiente, y nadie queda sin poder ingresar):
--
--   alter table public.usuarios_negocio drop column if exists debe_cambiar_pin;
--   drop table if exists public.recuperacion_pin_codigos;
--   -- Opcional: limpiar los contadores de intentos de esta función.
--   delete from public.intentos_ingreso
--    where telefono like 'reset:%' or telefono like 'pin:%' or telefono like 'recuperar:%';
-- ---------------------------------------------------------------------------
