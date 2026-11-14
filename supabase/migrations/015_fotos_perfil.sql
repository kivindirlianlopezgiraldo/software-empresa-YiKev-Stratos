-- Fotos de perfil con carga y eliminación limitadas al usuario propietario.
-- Ejecutar después de la migración 001.

do $$
begin
  if to_regclass('public.perfiles_usuario') is null then
    raise exception 'Falta la migración 001: no existe public.perfiles_usuario.';
  end if;
end
$$;

alter table public.perfiles_usuario
  add column if not exists foto_perfil text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfil',
  'fotos-perfil',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos_perfil_insert_propias" on storage.objects;
create policy "fotos_perfil_insert_propias"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos-perfil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos_perfil_delete_propias" on storage.objects;
create policy "fotos_perfil_delete_propias"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'fotos-perfil'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
