-- Cada renglón de una venta / ingreso / pedido tiene una posición fija dentro
-- de su cabecera. Así reintentar la subida (o re-subir un pedido o una venta
-- anulada) actualiza el mismo renglón en vez de insertar uno nuevo.
-- Reversible: drop index ... ; alter table ... drop column posicion;
alter table public.venta_items add column if not exists posicion integer;
alter table public.ingreso_items add column if not exists posicion integer;
alter table public.pedido_items add column if not exists posicion integer;

update public.venta_items v set posicion = n.p
from (select id, row_number() over (partition by venta_id order by id) - 1 as p from public.venta_items) n
where v.id = n.id and v.posicion is null;
update public.ingreso_items v set posicion = n.p
from (select id, row_number() over (partition by ingreso_id order by id) - 1 as p from public.ingreso_items) n
where v.id = n.id and v.posicion is null;
update public.pedido_items v set posicion = n.p
from (select id, row_number() over (partition by pedido_id order by id) - 1 as p from public.pedido_items) n
where v.id = n.id and v.posicion is null;

create unique index if not exists venta_items_venta_posicion on public.venta_items (venta_id, posicion);
create unique index if not exists ingreso_items_ingreso_posicion on public.ingreso_items (ingreso_id, posicion);
create unique index if not exists pedido_items_pedido_posicion on public.pedido_items (pedido_id, posicion);
