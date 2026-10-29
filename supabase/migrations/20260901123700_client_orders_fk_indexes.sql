-- Índices de cobertura para las claves foráneas de pedidos.
create index if not exists ventas_pedido_negocio_idx on public.ventas (pedido_id, negocio_id);
create index if not exists pedidos_cliente_negocio_idx on public.pedidos (cliente_id, negocio_id);
create index if not exists pedido_items_pedido_id_idx on public.pedido_items (pedido_id);
