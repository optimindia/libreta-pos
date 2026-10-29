
revoke all on table public.productos, public.ventas, public.venta_items,
  public.clientes, public.fiados, public.fiado_pagos, public.ingresos,
  public.ingreso_items, public.cierres, public.movimientos_caja,
  public.ventas_resumen from public, anon, authenticated;

grant select on table public.productos, public.ventas, public.venta_items,
  public.clientes, public.fiados, public.fiado_pagos, public.ingresos,
  public.ingreso_items, public.cierres, public.movimientos_caja to authenticated;

grant insert (id, negocio_id, codigo_barras, nombre, costo, precio, stock, stock_minimo)
  on table public.productos to authenticated;
grant update (id, negocio_id, codigo_barras, nombre, costo, precio, stock, stock_minimo)
  on table public.productos to authenticated;

grant insert (id, negocio_id, fecha, total, medio_pago, cliente_id, estado,
  estado_cobro, referencia_pago, anulada_en, motivo_anulacion)
  on table public.ventas to authenticated;
grant update (id, negocio_id, fecha, total, medio_pago, cliente_id, estado,
  estado_cobro, referencia_pago, anulada_en, motivo_anulacion)
  on table public.ventas to authenticated;

grant insert (id, venta_id, negocio_id, producto_id, nombre, cantidad, precio, costo)
  on table public.venta_items to authenticated;
grant update (id, venta_id, negocio_id, producto_id, nombre, cantidad, precio, costo)
  on table public.venta_items to authenticated;

grant insert (id, negocio_id, nombre, telefono) on table public.clientes to authenticated;
grant update (id, negocio_id, nombre, telefono) on table public.clientes to authenticated;

grant insert (id, negocio_id, cliente_id, venta_id, monto, fecha, vence, anulado_en)
  on table public.fiados to authenticated;
grant update (id, negocio_id, cliente_id, venta_id, monto, fecha, vence, anulado_en)
  on table public.fiados to authenticated;

grant insert (id, negocio_id, fiado_id, monto, fecha)
  on table public.fiado_pagos to authenticated;
grant update (id, negocio_id, fiado_id, monto, fecha)
  on table public.fiado_pagos to authenticated;

grant insert (id, negocio_id, fecha, proveedor, origen) on table public.ingresos to authenticated;
grant update (id, negocio_id, fecha, proveedor, origen) on table public.ingresos to authenticated;

grant insert (id, ingreso_id, negocio_id, producto_id, cantidad, costo_unitario)
  on table public.ingreso_items to authenticated;
grant update (id, ingreso_id, negocio_id, producto_id, cantidad, costo_unitario)
  on table public.ingreso_items to authenticated;

grant insert (id, negocio_id, fecha, fondo_inicial, ventas_efectivo,
  pagos_fiado_efectivo, esperado, contado) on table public.cierres to authenticated;
grant update (id, negocio_id, fecha, fondo_inicial, ventas_efectivo,
  pagos_fiado_efectivo, esperado, contado) on table public.cierres to authenticated;

grant insert (id, negocio_id, fecha, tipo, concepto, monto, medio_pago)
  on table public.movimientos_caja to authenticated;
grant update (id, negocio_id, fecha, tipo, concepto, monto, medio_pago)
  on table public.movimientos_caja to authenticated;
grant delete on table public.movimientos_caja to authenticated;
