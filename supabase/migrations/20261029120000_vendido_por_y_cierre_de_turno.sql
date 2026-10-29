-- FUN-04 (quién hizo cada venta) y FUN-05 (cierre de caja por turno).
--
-- Aditiva: sólo columnas NULLABLE y políticas. No borra, no reescribe ni toca
-- ninguna fila existente: lo anterior queda en NULL y la app lo muestra como
-- "Sin dato".
--
-- ORDEN DE DESPLIEGUE: aplicar esta migración ANTES de publicar la versión de
-- la app que sube estas columnas. PostgREST rechaza un payload con columnas
-- que la tabla no tiene, y la cola de subida quedaría reintentando.
--
-- Los GRANT de tabla (select, insert, update) ya cubren las columnas nuevas.

-- 1. Columnas ------------------------------------------------------------------
alter table public.ventas
  add column if not exists vendido_por uuid;

alter table public.fiado_pagos
  add column if not exists usuario_id uuid;

alter table public.cierres
  add column if not exists usuario_id uuid,
  add column if not exists alcance text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cierres_alcance_valido') then
    alter table public.cierres
      add constraint cierres_alcance_valido check (alcance is null or alcance in ('turno', 'caja'));
  end if;
end $$;

create index if not exists ventas_negocio_vendido_por on public.ventas (negocio_id, vendido_por);
create index if not exists cierres_negocio_usuario on public.cierres (negocio_id, usuario_id);

-- Las políticas que usan estas columnas están en 20261029120100 y requieren
-- haber aplicado antes 20261028140000 (permisos del vendedor).

-- Para revertir (los datos de las columnas nuevas se pierden al borrarlas):
-- drop index if exists public.ventas_negocio_vendido_por;
-- drop index if exists public.cierres_negocio_usuario;
-- alter table public.cierres drop constraint if exists cierres_alcance_valido;
-- alter table public.cierres drop column if exists alcance, drop column if exists usuario_id;
-- alter table public.fiado_pagos drop column if exists usuario_id;
-- alter table public.ventas drop column if exists vendido_por;
