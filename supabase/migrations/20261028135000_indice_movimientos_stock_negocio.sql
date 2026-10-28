-- El advisor de rendimiento marca la FK movimientos_stock.negocio_id sin índice.
-- Aditiva. Para revertir: drop index if exists public.movimientos_stock_negocio_id_idx;
create index if not exists movimientos_stock_negocio_id_idx on public.movimientos_stock (negocio_id);
