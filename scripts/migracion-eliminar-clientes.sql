-- Habilita la eliminación explícita de clientes sin abrirla a visitantes.
-- La política RLS con_suscripcion_activa ya restringe la fila al negocio
-- autenticado y las claves foráneas mantienen protegido el historial.
revoke delete on table public.clientes from public, anon, authenticated;
grant delete on table public.clientes to authenticated;
