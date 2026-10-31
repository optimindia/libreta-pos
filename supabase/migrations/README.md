# Migraciones de Supabase

Cada archivo es una migración aditiva e idempotente, con la misma versión
(`AAAAMMDDHHMMSS`) y nombre con que quedó registrada en la base de Libreta.

Las quince primeras (`20260901…` y `20260906…`) se exportaron de
`supabase_migrations.schema_migrations` de la base real (DAT-02): son el SQL
tal como se aplicó. Se escribieron sobre un esquema base (tablas `negocios`,
`productos`, `ventas`, `clientes`, `fiados`, `suscripciones`, etc.) que se
creó antes con scripts sueltos (`migracion-seguridad-plataforma.sql` y
`migracion-suscripciones-manuales.sql`) y que **no** está en esta carpeta:
por eso no se pueden aplicar desde cero sobre una base vacía. Para levantar
una base nueva hace falta antes ese esquema base.

Las versiones `20261028…` en adelante se aplican con la fecha de este repo;
en la base figuran con la hora real de aplicación, y el contenido es el mismo.

Regla: nunca editar una migración ya aplicada; se agrega otra.

Regla: cada columna nueva que la app sube necesita su propio
`grant insert (col), update (col) ... to authenticated`. Los permisos de las
tablas del negocio son por columna; sin ese GRANT la subida falla con 42501
y la operación queda apartada como rechazada (pasó el 29/10 con
`vendido_por` y el 31/10 con `unidad`).
