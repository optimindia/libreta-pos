-- Mejora #21: la venta en la que el cliente usó su premio de fidelidad
-- (la décima gratis). Los sellos se cuentan con las ventas; esto marca el
-- canje para empezar de nuevo. Aditiva.
alter table public.ventas add column if not exists canje_fidelidad boolean not null default false;
grant insert (canje_fidelidad), update (canje_fidelidad) on table public.ventas to authenticated;
