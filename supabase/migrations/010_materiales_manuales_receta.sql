-- Permite escribir materiales propios de cada sistema sin exigir que existan
-- previamente en el inventario general.
alter table public.sistema_materiales
  alter column material_id drop not null;

alter table public.sistema_materiales
  add column if not exists material_nombre text;

update public.sistema_materiales sm
set material_nombre = m.nombre
from public.inventario_materiales m
where sm.material_id = m.id
  and (sm.material_nombre is null or btrim(sm.material_nombre) = '');

notify pgrst, 'reload schema';
