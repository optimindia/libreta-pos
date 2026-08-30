-- Borra los negocios y usuarios que dejan las pruebas.
-- Ejecutar en el SQL Editor de Supabase cuando la base se llene de basura
-- de prueba. NO toca los negocios reales: sólo los que tienen nombre de prueba.

delete from negocios
where nombre ilike '%de prueba%'
   or nombre in ('Almacén Rosales', 'Kiosco El Vecino');

delete from auth.users
where email like '%libreta.app'
  and id not in (select usuario_id from usuarios_negocio);
