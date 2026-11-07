-- Mejora #6: devolución parcial. La venta guarda lo que se devolvió
-- (renglones, monto, fecha, motivo); sus renglones y total ya quedan
-- descontados. Aditiva: columna nueva, nullable, con su permiso.
alter table public.ventas add column if not exists devoluciones jsonb;
grant insert (devoluciones), update (devoluciones) on table public.ventas to authenticated;
