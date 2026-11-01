-- Quitar un cliente de la cartera sin borrar su historial (1/11).
-- Antes el borrado fallaba si el cliente tenía ventas o fiados, y el límite
-- de fiado no se subía a la nube, así que cualquier bajada lo pisaba.
--
-- Aditiva: una columna nueva y su permiso de actualización.

alter table public.clientes add column if not exists eliminado_en timestamptz;
grant update (eliminado_en) on table public.clientes to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261031140000', 'sincronizacion_completa', array['ver supabase/migrations/20261031140000_sincronizacion_completa.sql'])
on conflict do nothing;
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261101120000', 'clientes_archivados', array['ver supabase/migrations/20261101120000_clientes_archivados.sql'])
on conflict do nothing;
