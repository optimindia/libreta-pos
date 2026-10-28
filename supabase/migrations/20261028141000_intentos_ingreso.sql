-- SEG-03: intentos de ingreso con PIN, por teléfono.
-- Aditiva. La usa sólo la función Edge `ingresar` con service role: el
-- navegador no puede leerla ni escribirla (RLS sin políticas + sin grants),
-- así nadie puede ver qué teléfonos se están probando ni borrarse el bloqueo.
create table if not exists public.intentos_ingreso (
  telefono text primary key,
  fallos integer not null default 0 check (fallos >= 0),
  desde timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  version bigint not null default 1,
  actualizado_en timestamptz not null default now()
);

comment on table public.intentos_ingreso is
  'Conteo de intentos de PIN por teléfono normalizado (SEG-03). Sólo service role.';

alter table public.intentos_ingreso enable row level security;
alter table public.intentos_ingreso force row level security;

revoke all on table public.intentos_ingreso from public, anon, authenticated;
grant select, insert, update, delete on table public.intentos_ingreso to service_role;

-- Para limpiar filas viejas sin recorrer toda la tabla.
create index if not exists intentos_ingreso_actualizado_en on public.intentos_ingreso (actualizado_en);
