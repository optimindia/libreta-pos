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

-- 2. Nadie firma con el nombre de otro ------------------------------------------
-- Un vendedor sólo puede dejar su propio id (o ninguno: así las versiones
-- viejas de la app siguen subiendo). El dueño puede subir cualquiera, que es
-- lo que pasa cuando anula o re-sube la venta de un vendedor.
do $$
declare
  tabla text;
  columna text;
begin
  for tabla, columna in select * from (values ('ventas', 'vendido_por'), ('fiado_pagos', 'usuario_id')) as t(a, b) loop
    execute format('drop policy if exists firma_propia_inserta on public.%I', tabla);
    execute format($p$
      create policy firma_propia_inserta on public.%I
        as restrictive for insert to authenticated
        with check (
          (select private.es_dueno(negocio_id))
          or %I is null
          or %I = (select auth.uid())
        )
    $p$, tabla, columna, columna);
    execute format('drop policy if exists firma_propia_modifica on public.%I', tabla);
    execute format($p$
      create policy firma_propia_modifica on public.%I
        as restrictive for update to authenticated
        using (true)
        with check (
          (select private.es_dueno(negocio_id))
          or %I is null
          or %I = (select auth.uid())
        )
    $p$, tabla, columna, columna);
  end loop;
end $$;

-- 3. El vendedor cierra SU turno -------------------------------------------------
-- 20261028140000 dejó cierres como sólo-dueño. Se reemplazan las políticas
-- restrictivas de insert y update por otras que además dejan pasar el cierre
-- de turno propio (alcance = 'turno' y usuario_id = quien llama). Cubrir el
-- update hace falta porque la subida es un upsert: un reintento tras un éxito
-- parcial cae en el UPDATE. Borrar sigue siendo sólo del dueño, y el vendedor
-- no puede crear ni tocar el cierre del día (alcance 'caja' o NULL).
drop policy if exists solo_dueno_inserta on public.cierres;
create policy solo_dueno_inserta on public.cierres
  as restrictive for insert to authenticated
  with check (
    (select private.es_dueno(negocio_id))
    or (alcance = 'turno' and usuario_id = (select auth.uid()))
  );

drop policy if exists solo_dueno_modifica on public.cierres;
create policy solo_dueno_modifica on public.cierres
  as restrictive for update to authenticated
  using (
    (select private.es_dueno(negocio_id))
    or (alcance = 'turno' and usuario_id = (select auth.uid()))
  )
  with check (
    (select private.es_dueno(negocio_id))
    or (alcance = 'turno' and usuario_id = (select auth.uid()))
  );

-- Para revertir (los datos de las columnas nuevas se pierden al borrarlas):
-- drop policy if exists solo_dueno_inserta on public.cierres;
-- create policy solo_dueno_inserta on public.cierres
--   as restrictive for insert to authenticated
--   with check ((select private.es_dueno(negocio_id)));
-- drop policy if exists solo_dueno_modifica on public.cierres;
-- create policy solo_dueno_modifica on public.cierres
--   as restrictive for update to authenticated
--   using ((select private.es_dueno(negocio_id)))
--   with check ((select private.es_dueno(negocio_id)));
-- drop policy if exists firma_propia_inserta on public.ventas;
-- drop policy if exists firma_propia_modifica on public.ventas;
-- drop policy if exists firma_propia_inserta on public.fiado_pagos;
-- drop policy if exists firma_propia_modifica on public.fiado_pagos;
-- drop index if exists public.ventas_negocio_vendido_por;
-- drop index if exists public.cierres_negocio_usuario;
-- alter table public.cierres drop constraint if exists cierres_alcance_valido;
-- alter table public.cierres drop column if exists alcance, drop column if exists usuario_id;
-- alter table public.fiado_pagos drop column if exists usuario_id;
-- alter table public.ventas drop column if exists vendido_por;
