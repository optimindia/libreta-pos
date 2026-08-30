-- Migración de la tabla cierres para bases ya creadas.
-- Es idempotente: se puede correr todas las veces que haga falta.

create table if not exists cierres (
  id uuid primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  fecha timestamptz not null,
  fondo_inicial bigint not null,
  ventas_efectivo bigint not null,
  pagos_fiado_efectivo bigint not null,
  esperado bigint not null,
  contado bigint not null
);

create index if not exists cierres_negocio_id_fecha_idx on cierres (negocio_id, fecha desc);

alter table cierres enable row level security;

drop policy if exists solo_mi_negocio on cierres;
create policy solo_mi_negocio on cierres for all
  using (negocio_id in (select negocios_del_usuario()))
  with check (negocio_id in (select negocios_del_usuario()));