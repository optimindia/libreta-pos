
create unique index if not exists productos_id_negocio_uidx
  on public.productos (id, negocio_id);
create unique index if not exists suscripciones_id_negocio_uidx
  on public.suscripciones (id, negocio_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venta_items_producto_negocio_fkey') then
    alter table public.venta_items
      add constraint venta_items_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ingreso_items_producto_negocio_fkey') then
    alter table public.ingreso_items
      add constraint ingreso_items_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_resumen_producto_negocio_fkey') then
    alter table public.ventas_resumen
      add constraint ventas_resumen_producto_negocio_fkey
      foreign key (producto_id, negocio_id)
      references public.productos (id, negocio_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suscripcion_eventos_suscripcion_negocio_fkey') then
    alter table public.suscripcion_eventos
      add constraint suscripcion_eventos_suscripcion_negocio_fkey
      foreign key (suscripcion_id, negocio_id)
      references public.suscripciones (id, negocio_id);
  end if;
end
$$;
