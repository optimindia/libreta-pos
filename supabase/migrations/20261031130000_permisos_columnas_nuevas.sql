-- Las tablas del negocio usan permisos POR COLUMNA para `authenticated`
-- (ver 20260901103146_server_owned_update_timestamp_grants). Un GRANT de tabla
-- no existe, así que cada columna nueva que la app sube necesita su propio
-- GRANT; si no, PostgREST responde 42501 "permission denied for table" y la
-- cola de subida aparta la operación como rechazada.
--
-- Esto pasó con vendido_por (29/10), usuario_id/alcance y unidad (31/10):
-- las ventas, cobros de fiado y fichas nuevas dejaron de subir a la nube.
-- Aditiva: sólo agrega permisos que la app ya necesitaba.

grant insert (vendido_por, pedido_id), update (vendido_por, pedido_id) on table public.ventas to authenticated;
grant insert (usuario_id), update (usuario_id) on table public.fiado_pagos to authenticated;
grant insert (usuario_id, alcance), update (usuario_id, alcance) on table public.cierres to authenticated;
grant insert (unidad), update (unidad) on table public.productos to authenticated;
