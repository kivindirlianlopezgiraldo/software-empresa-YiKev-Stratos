-- ============================================================================
-- YiKev Stratos ERP — Migración 002
-- Dirección del cliente, notas de medidas y fotos de referencia
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001 (o al menos después de que exista
--     public.ordenes_trabajo y la función public.es_admin()).
--     Es idempotente: se puede ejecutar varias veces.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Seguridad: verificar que estamos en el proyecto correcto.
--    Si este mensaje falla, el SQL Editor está apuntando a otro proyecto.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ordenes_trabajo'
  ) then
    raise exception 'Proyecto equivocado: no existe public.ordenes_trabajo. Abre el proyecto lctgnurjflnzvlwgdtmi.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Datos de ubicación y de la visita de medidas
-- ----------------------------------------------------------------------------
alter table public.ordenes_trabajo add column if not exists cliente_direccion text;
alter table public.ordenes_trabajo add column if not exists cliente_barrio text;
alter table public.ordenes_trabajo add column if not exists notas_medidas text;
alter table public.ordenes_trabajo add column if not exists imagenes_referencia text[] not null default '{}';
alter table public.ordenes_trabajo add column if not exists medido_en timestamptz;
alter table public.ordenes_trabajo add column if not exists medido_por text;

-- ----------------------------------------------------------------------------
-- 2) Bucket privado para las fotos de referencia
--    Las imágenes se leen con URLs firmadas (createSignedUrl), no públicas.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'referencias',
  'referencias',
  false,
  5242880, -- 5 MB por archivo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- ----------------------------------------------------------------------------
-- 3) Políticas del bucket (solo usuarios autenticados)
-- ----------------------------------------------------------------------------
drop policy if exists "referencias_select" on storage.objects;
create policy "referencias_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'referencias');

drop policy if exists "referencias_insert" on storage.objects;
create policy "referencias_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'referencias');

drop policy if exists "referencias_delete" on storage.objects;
create policy "referencias_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'referencias');

-- ----------------------------------------------------------------------------
-- 4) Refrescar la caché de PostgREST para que las columnas nuevas
--    estén disponibles de inmediato en la API.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 5) Comprobación final: el SQL Editor debe mostrar este mensaje.
-- ----------------------------------------------------------------------------
select 'Migración 002 aplicada: columnas y bucket referencias listos' as resultado;
