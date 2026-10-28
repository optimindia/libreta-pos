-- Vendedores: varias personas por negocio, cada una con su teléfono y PIN.
-- Aditiva: las filas existentes quedan como 'dueno'.
alter table public.usuarios_negocio
  add column if not exists rol text not null default 'dueno',
  add column if not exists nombre text,
  add column if not exists telefono text,
  add column if not exists creado_en timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_negocio_rol_valido') then
    alter table public.usuarios_negocio
      add constraint usuarios_negocio_rol_valido check (rol in ('dueno', 'vendedor'));
  end if;
end $$;

create index if not exists usuarios_negocio_negocio_rol on public.usuarios_negocio (negocio_id, rol);
