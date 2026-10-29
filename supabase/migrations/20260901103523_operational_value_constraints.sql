
do $$
declare
  chequeo record;
begin
  for chequeo in
    select * from (values
      ('productos', 'productos_nombre_largo', 'length(btrim(nombre)) between 2 and 160'),
      ('productos', 'productos_codigo_barras_formato', 'codigo_barras is null or codigo_barras ~ ''^[a-zA-Z0-9-]{3,32}$'''),
      ('ventas', 'ventas_estado_valido', 'estado in (''completada'', ''anulada'')'),
      ('ventas', 'ventas_estado_cobro_valido', 'estado_cobro in (''confirmado'', ''pendiente'')'),
      ('ingresos', 'ingresos_origen_valido', 'origen in (''manual'', ''foto'')'),
      ('movimientos_caja', 'movimientos_caja_medio_pago_valido', 'medio_pago in (''efectivo'', ''transferencia'', ''qr'')'),
      ('movimientos_caja', 'movimientos_caja_concepto_largo', 'length(btrim(concepto)) between 1 and 200')
    ) as t(tabla, nombre, expresion)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', chequeo.tabla)::regclass
        and conname = chequeo.nombre
    ) then
      execute format(
        'alter table public.%I add constraint %I check (%s) not valid',
        chequeo.tabla, chequeo.nombre, chequeo.expresion
      );
    end if;
  end loop;
end
$$;
