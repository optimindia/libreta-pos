alter table public.productos
  add column if not exists eliminado_en timestamptz;

create index if not exists productos_negocio_eliminado_idx
  on public.productos (negocio_id, eliminado_en);

grant select on table public.productos to authenticated;

grant insert (id, negocio_id, codigo_barras, nombre, costo, precio, stock,
  stock_minimo, precio_oferta, oferta_hasta)
  on table public.productos to authenticated;

grant update (id, negocio_id, codigo_barras, nombre, costo, precio, stock,
  stock_minimo, precio_oferta, oferta_hasta, eliminado_en)
  on table public.productos to authenticated;
