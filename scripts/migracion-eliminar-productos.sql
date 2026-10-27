-- Eliminación segura de productos y sincronización multidispositivo.
-- Se conserva una marca técnica en la nube para que los otros dispositivos
-- retiren el producto sin borrar ventas, ingresos ni pedidos históricos.

alter table public.productos
  add column if not exists eliminado_en timestamptz;

create index if not exists productos_negocio_eliminado_idx
  on public.productos (negocio_id, eliminado_en);

-- El cliente nunca recibe permiso de borrado físico: la app usa UPDATE para
-- marcar la baja y RLS sigue limitando esa actualización al negocio activo.
grant select on table public.productos to authenticated;
grant insert (id, negocio_id, codigo_barras, nombre, costo, precio, stock,
  stock_minimo, precio_oferta, oferta_hasta)
  on table public.productos to authenticated;
grant update (id, negocio_id, codigo_barras, nombre, costo, precio, stock,
  stock_minimo, precio_oferta, oferta_hasta, eliminado_en)
  on table public.productos to authenticated;
