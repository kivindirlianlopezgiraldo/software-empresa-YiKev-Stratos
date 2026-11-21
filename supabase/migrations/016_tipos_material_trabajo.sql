-- Catálogo configurable de vidrios y acrílicos para proyectos de órdenes.

create table if not exists public.tipos_material_trabajo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint tipos_material_trabajo_nombre_unico unique (nombre)
);

insert into public.tipos_material_trabajo (nombre)
values
  ('Vidrio claro'),
  ('Vidrio bronce'),
  ('Vidrio gris'),
  ('Vidrio templado claro'),
  ('Vidrio templado bronce'),
  ('Vidrio laminado'),
  ('Vidrio esmerilado'),
  ('Espejo'),
  ('Acrílico'),
  ('Acrílico transparente'),
  ('Acrílico humo'),
  ('Sin vidrio')
on conflict (nombre) do nothing;

alter table public.tipos_material_trabajo enable row level security;

revoke all on public.tipos_material_trabajo from anon;
grant select, insert, update, delete on public.tipos_material_trabajo to authenticated;

drop policy if exists "tipos_material_select" on public.tipos_material_trabajo;
create policy "tipos_material_select"
  on public.tipos_material_trabajo
  for select to authenticated
  using (true);

drop policy if exists "tipos_material_insert" on public.tipos_material_trabajo;
create policy "tipos_material_insert"
  on public.tipos_material_trabajo
  for insert to authenticated
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "tipos_material_update" on public.tipos_material_trabajo;
create policy "tipos_material_update"
  on public.tipos_material_trabajo
  for update to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "tipos_material_delete" on public.tipos_material_trabajo;
create policy "tipos_material_delete"
  on public.tipos_material_trabajo
  for delete to authenticated
  using (public.es_admin() or public.es_jefe());

notify pgrst, 'reload schema';
