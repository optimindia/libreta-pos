-- FUN-04 / FUN-05: políticas de firma propia y cierre de turno del vendedor.
-- REQUIERE haber aplicado antes 20261028140000_permisos_vendedor.sql (usa
-- private.es_dueno y reemplaza sus políticas restrictivas de cierres) y
-- 20261029120000 (columnas).

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

-- Para revertir:
-- drop policy if exists firma_propia_inserta on public.ventas;
-- drop policy if exists firma_propia_modifica on public.ventas;
-- drop policy if exists firma_propia_inserta on public.fiado_pagos;
-- drop policy if exists firma_propia_modifica on public.fiado_pagos;
-- drop policy if exists solo_dueno_inserta on public.cierres;
-- create policy solo_dueno_inserta on public.cierres as restrictive for insert to authenticated with check ((select private.es_dueno(negocio_id)));
-- drop policy if exists solo_dueno_modifica on public.cierres;
-- create policy solo_dueno_modifica on public.cierres as restrictive for update to authenticated using ((select private.es_dueno(negocio_id))) with check ((select private.es_dueno(negocio_id)));
