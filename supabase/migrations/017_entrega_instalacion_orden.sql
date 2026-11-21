-- Define si una orden terminada se instala el taller o se entrega directamente al cliente.

alter table public.ordenes_trabajo
  add column if not exists tipo_entrega text;

alter table public.ordenes_trabajo
  drop constraint if exists ordenes_trabajo_tipo_entrega_check;

alter table public.ordenes_trabajo
  add constraint ordenes_trabajo_tipo_entrega_check
  check (tipo_entrega is null or tipo_entrega in ('instalacion', 'entrega_cliente'));

notify pgrst, 'reload schema';
