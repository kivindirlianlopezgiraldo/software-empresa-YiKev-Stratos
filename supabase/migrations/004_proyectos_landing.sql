-- ============================================================================
-- YiKev Stratos ERP — Migración 004
-- Portafolio de proyectos realizados + textos editables de la landing
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001, 002 y 003 en el SQL Editor del proyecto
--     correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede ejecutar
--     varias veces sin perder datos.
--
-- Contenido:
--   1) Tabla `proyectos` con fotos, publicación y orden.
--   2) Tabla `landing_config` de una sola fila con los textos del sitio.
--   3) Vistas públicas `proyectos_publicos` y `landing_publica` para que el
--      sitio web lea solo lo publicado, sin exponer borradores.
--   4) Bucket público `proyectos` para las fotos del portafolio, con escritura
--      reservada al rol administrador.
--   5) RLS y permisos para que solo el administrador edite el sitio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Seguridad: verificar que estamos en el proyecto correcto.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'perfiles_usuario'
  ) then
    raise exception 'Proyecto equivocado: no existe public.perfiles_usuario. Abre el proyecto lctgnurjflnzvlwgdtmi.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_admin'
  ) then
    raise exception 'Falta la migración 001: no existe la función public.es_admin().';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Proyectos realizados
--    `imagenes` es un arreglo JSON de rutas. La primera imagen es la portada.
-- ----------------------------------------------------------------------------
create table if not exists public.proyectos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default 'Aluminio',
  cliente text,
  ubicacion text,
  anio integer,
  descripcion text,
  materiales text,
  imagenes jsonb not null default '[]'::jsonb,
  destacado boolean not null default false,
  publicado boolean not null default false,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por text,
  constraint proyectos_imagenes_arreglo check (jsonb_typeof(imagenes) = 'array')
);

create index if not exists proyectos_publicados_idx
  on public.proyectos (publicado, destacado desc, orden asc, creado_en desc);

create or replace function public.marcar_proyecto_actualizado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

drop trigger if exists tr_proyecto_actualizado on public.proyectos;
create trigger tr_proyecto_actualizado
  before update on public.proyectos
  for each row execute function public.marcar_proyecto_actualizado();

-- ----------------------------------------------------------------------------
-- 2) Textos editables de la landing (una sola fila, id = 1)
-- ----------------------------------------------------------------------------
create table if not exists public.landing_config (
  id integer primary key default 1 check (id = 1),

  hero_etiqueta text not null default 'Taller en Quibdó, Chocó',
  hero_titulo text not null default 'Espacios que se sienten',
  hero_destacado text not null default 'a medida.',
  hero_texto text not null default 'Diseñamos, fabricamos e instalamos ventanas, puertas, fachadas y divisiones en aluminio, vidrio templado, PVC y acrílico. Precisión de taller, materiales de calidad y acabados que duran.',
  hero_beneficios text not null default 'Medición en sitio|Fabricación propia|Instalación garantizada',

  nosotros_titulo text not null default 'Oficio, técnica y acabados que se notan',
  nosotros_texto text not null default 'Somos un taller de Quibdó especializado en carpintería de aluminio y vidrio. Trabajamos con medidas exactas, materiales seleccionados y un equipo propio que acompaña el proyecto hasta la instalación.',

  proyectos_titulo text not null default 'Proyectos realizados',
  proyectos_texto text not null default 'Una muestra de los trabajos que hemos entregado en vivienda, comercio y obra. Cada proyecto se mide, se fabrica y se instala con el mismo cuidado.',
  mostrar_proyectos boolean not null default true,
  proyectos_limite integer not null default 6,

  contacto_titulo text not null default 'Cuéntanos qué necesitas',
  contacto_texto text not null default 'Escríbenos con las medidas aproximadas, el tipo de trabajo y la ciudad. Te respondemos con los siguientes pasos.',
  whatsapp_mensaje text not null default 'Hola, quiero cotizar un proyecto en aluminio y vidrio.',

  actualizado_en timestamptz not null default now(),
  actualizado_por text
);

insert into public.landing_config (id)
values (1)
on conflict (id) do nothing;

create or replace function public.marcar_landing_actualizada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

drop trigger if exists tr_landing_actualizada on public.landing_config;
create trigger tr_landing_actualizada
  before update on public.landing_config
  for each row execute function public.marcar_landing_actualizada();

-- ----------------------------------------------------------------------------
-- 3) RLS de proyectos
--    Personal autenticado: ve publicados y, si es admin, también borradores.
--    Anónimos: no acceden a la tabla; leen la vista pública.
-- ----------------------------------------------------------------------------
alter table public.proyectos enable row level security;

revoke all on public.proyectos from anon;
grant select, insert, update, delete on public.proyectos to authenticated;

drop policy if exists "proyectos_select" on public.proyectos;
create policy "proyectos_select" on public.proyectos
  for select to authenticated
  using (publicado or public.es_admin());

drop policy if exists "proyectos_insert" on public.proyectos;
create policy "proyectos_insert" on public.proyectos
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "proyectos_update" on public.proyectos;
create policy "proyectos_update" on public.proyectos
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "proyectos_delete" on public.proyectos;
create policy "proyectos_delete" on public.proyectos
  for delete to authenticated
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- 4) RLS de los textos de la landing
-- ----------------------------------------------------------------------------
alter table public.landing_config enable row level security;

revoke all on public.landing_config from anon;
grant select, insert, update, delete on public.landing_config to authenticated;

drop policy if exists "landing_select" on public.landing_config;
create policy "landing_select" on public.landing_config
  for select to authenticated
  using (true);

drop policy if exists "landing_insert" on public.landing_config;
create policy "landing_insert" on public.landing_config
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "landing_update" on public.landing_config;
create policy "landing_update" on public.landing_config
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "landing_delete" on public.landing_config;
create policy "landing_delete" on public.landing_config
  for delete to authenticated
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- 5) Vistas públicas para la landing
--    Las vistas se ejecutan con los permisos de su dueño, así que pueden
--    filtrar los borradores sin exponer la tabla completa a los anónimos.
-- ----------------------------------------------------------------------------
create or replace view public.proyectos_publicos as
select
  id,
  titulo,
  categoria,
  cliente,
  ubicacion,
  anio,
  descripcion,
  materiales,
  imagenes,
  destacado,
  orden,
  creado_en
from public.proyectos
where publicado = true
order by destacado desc, orden asc, creado_en desc;

revoke all on public.proyectos_publicos from anon;
grant select on public.proyectos_publicos to anon, authenticated;

create or replace view public.landing_publica as
select
  id,
  hero_etiqueta,
  hero_titulo,
  hero_destacado,
  hero_texto,
  hero_beneficios,
  nosotros_titulo,
  nosotros_texto,
  proyectos_titulo,
  proyectos_texto,
  mostrar_proyectos,
  proyectos_limite,
  contacto_titulo,
  contacto_texto,
  whatsapp_mensaje,
  actualizado_en
from public.landing_config
where id = 1;

revoke all on public.landing_publica from anon;
grant select on public.landing_publica to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) Bucket público para las fotos del portafolio
--    Es público porque estas imágenes son material de marketing y se muestran
--    en la web. La escritura queda reservada al administrador.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proyectos',
  'proyectos',
  true,
  5242880, -- 5 MB por archivo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "proyectos_bucket_select" on storage.objects;
create policy "proyectos_bucket_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'proyectos');

drop policy if exists "proyectos_bucket_insert" on storage.objects;
create policy "proyectos_bucket_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proyectos' and public.es_admin());

drop policy if exists "proyectos_bucket_update" on storage.objects;
create policy "proyectos_bucket_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'proyectos' and public.es_admin())
  with check (bucket_id = 'proyectos' and public.es_admin());

drop policy if exists "proyectos_bucket_delete" on storage.objects;
create policy "proyectos_bucket_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proyectos' and public.es_admin());

-- ----------------------------------------------------------------------------
-- 7) Refrescar la caché de PostgREST para que las tablas y vistas nuevas
--    estén disponibles de inmediato en la API.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 8) Comprobación final: el SQL Editor debe mostrar este mensaje.
-- ----------------------------------------------------------------------------
select 'Migración 004 aplicada: proyectos, landing_config, vistas públicas y bucket listos' as resultado;
