-- ============================================================================
-- YiKev Stratos ERP — Migración 001
-- Esquema base + identidad, integridad y seguridad (RLS)
-- ============================================================================
--
-- ⚠️  ANTES DE EJECUTAR
--  1. Haz un respaldo: Dashboard -> Database -> Backups.
--  2. Ejecuta esto en el SQL Editor del proyecto correcto.
--  3. Es idempotente: se puede ejecutar en un proyecto nuevo (crea las tablas)
--     o en uno existente (solo agrega lo que falte).
--  4. Los bloques están numerados. El bloque 7 (borrar `password`) es el ÚLTIMO
--     paso y solo debe ejecutarse cuando todos los usuarios ya tengan cuenta de
--     Auth con su documento (ver bloque 6).
--
-- Modelo de acceso:
--   documento de identidad ->  <documento>@yikevstratos.local  (cuenta Auth)
--   el perfil se enlaza por `id` = auth.users.id
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) Esquema base
--    Crea las tablas si no existen. En una base que ya funciona no las toca;
--    en un proyecto nuevo de Supabase deja el esquema completo listo.
--    `categoria` es text: el frontend usa el catálogo de src/lib/constants.js.
-- ----------------------------------------------------------------------------
create table if not exists public.perfiles_usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_completo text not null default '',
  documento_id text,
  telefono text,
  rol text not null default 'produccion',
  departamento text,
  tipo_contrato text,
  salario numeric not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists public.ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  codigo_orden text not null unique,
  cliente_nombre text not null,
  cliente_telefono text,
  tipo_trabajo text,
  medidas_terreno text,
  estado text not null default 'Pendiente de Asignación',
  prioridad text not null default 'Normal',
  fecha_entrega date,
  instalador_id uuid references public.perfiles_usuario (id) on delete set null,
  instalador_nombre text,
  entregado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index if not exists ordenes_trabajo_estado_idx
  on public.ordenes_trabajo (estado);
create index if not exists ordenes_trabajo_creado_en_idx
  on public.ordenes_trabajo (creado_en desc);

create table if not exists public.inventario_materiales (
  id uuid primary key default gen_random_uuid(),
  codigo_referencia text,
  nombre text not null,
  categoria text not null default 'Perfiles de Aluminio',
  unidad_medida text not null default 'Unidad',
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  precio_costo numeric not null default 0,
  precio_venta numeric not null default 0,
  proveedor_id uuid,
  creado_en timestamptz not null default now()
);

create table if not exists public.sistemas_trabajo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  linea text,
  descripcion text,
  creado_en timestamptz not null default now()
);

create table if not exists public.sistema_materiales (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas_trabajo (id) on delete cascade,
  material_id uuid not null references public.inventario_materiales (id) on delete cascade,
  cantidad_requerida numeric not null default 1,
  unique (sistema_id, material_id)
);

create index if not exists sistema_materiales_sistema_id_idx
  on public.sistema_materiales (sistema_id);


-- ----------------------------------------------------------------------------
-- 1) Normalizar la columna del documento
-- ----------------------------------------------------------------------------
do $$
begin
  -- Si existe `cedula` y no existe `documento_id`, renombrar.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles_usuario' and column_name = 'cedula'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles_usuario' and column_name = 'documento_id'
  ) then
    alter table public.perfiles_usuario rename column cedula to documento_id;
  end if;

  -- Crear la columna si no existe ninguna de las dos.
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles_usuario' and column_name = 'documento_id'
  ) then
    alter table public.perfiles_usuario add column documento_id text;
  end if;
end
$$;

-- Un documento = un colaborador
create unique index if not exists perfiles_usuario_documento_id_key
  on public.perfiles_usuario (documento_id)
  where documento_id is not null;

-- Columnas de fecha / contrato que usa la interfaz
alter table public.perfiles_usuario add column if not exists creado_en timestamptz not null default now();
alter table public.perfiles_usuario add column if not exists tipo_contrato text;
alter table public.perfiles_usuario add column if not exists activo boolean not null default true;

-- Columnas legacy (`password`, `cedula`): la aplicación ya no las escribe.
-- Si quedaron como NOT NULL, relajarlas evita que falle el alta de colaboradores.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles_usuario' and column_name = 'password'
  ) then
    execute 'alter table public.perfiles_usuario alter column password drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'perfiles_usuario' and column_name = 'cedula'
  ) then
    execute 'alter table public.perfiles_usuario alter column cedula drop not null';
  end if;
end
$$;

-- Órdenes: columnas que usa el flujo de trabajo.
-- `cliente_nombre`, `cliente_telefono`, `medidas_terreno` y `creado_en` ya existen
-- en la base actual; se declaran igual para que la migración sea segura en
-- cualquier instalación.
alter table public.ordenes_trabajo add column if not exists cliente_nombre text;
alter table public.ordenes_trabajo add column if not exists cliente_telefono text;
alter table public.ordenes_trabajo add column if not exists medidas_terreno text;
alter table public.ordenes_trabajo add column if not exists tipo_trabajo text;
alter table public.ordenes_trabajo add column if not exists instalador_id uuid;
alter table public.ordenes_trabajo add column if not exists instalador_nombre text;
alter table public.ordenes_trabajo add column if not exists entregado_en timestamptz;
alter table public.ordenes_trabajo add column if not exists creado_en timestamptz not null default now();

-- Las políticas de RLS consultan `instalador_id` en cada fila.
create index if not exists ordenes_trabajo_instalador_id_idx
  on public.ordenes_trabajo (instalador_id);

-- Inventario / sistemas
alter table public.inventario_materiales add column if not exists creado_en timestamptz not null default now();
alter table public.sistemas_trabajo add column if not exists creado_en timestamptz not null default now();


-- ----------------------------------------------------------------------------
-- 2) Funciones de permisos (SECURITY DEFINER para evitar recursión en RLS)
-- ----------------------------------------------------------------------------
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select rol from public.perfiles_usuario where id = auth.uid()), '');
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (lower(rol) like '%admin%' or lower(rol) like '%gerencia%' or lower(rol) like '%super%')
    from public.perfiles_usuario
    where id = auth.uid()
  ), false);
$$;

create or replace function public.es_jefe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select lower(rol) like '%jefe%'
    from public.perfiles_usuario
    where id = auth.uid()
  ), false);
$$;

create or replace function public.es_taller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (lower(rol) like '%producci%' or lower(rol) like '%taller%' or lower(rol) like '%vidriero%')
    from public.perfiles_usuario
    where id = auth.uid()
  ), false);
$$;

create or replace function public.es_bodega()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (lower(rol) like '%bodega%' or lower(rol) like '%almac%')
    from public.perfiles_usuario
    where id = auth.uid()
  ), false);
$$;

create or replace function public.es_instalador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select lower(rol) like '%instalador%'
    from public.perfiles_usuario
    where id = auth.uid()
  ), false);
$$;


-- ----------------------------------------------------------------------------
-- 3) Impedir escalada de privilegios desde el propio perfil
--    Un usuario puede editar su nombre/teléfono, pero no su rol ni su salario.
-- ----------------------------------------------------------------------------
create or replace function public.proteger_campos_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Operaciones desde el SQL Editor / service_role no tienen auth.uid().
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if new.rol is distinct from old.rol
     or new.salario is distinct from old.salario
     or new.departamento is distinct from old.departamento
     or new.tipo_contrato is distinct from old.tipo_contrato
     or new.documento_id is distinct from old.documento_id
     or new.activo is distinct from old.activo then
    raise exception 'No tienes permiso para modificar rol, salario, departamento ni documento.';
  end if;

  return new;
end
$$;

drop trigger if exists tr_proteger_campos_perfil on public.perfiles_usuario;
create trigger tr_proteger_campos_perfil
  before update on public.perfiles_usuario
  for each row execute function public.proteger_campos_perfil();


-- ----------------------------------------------------------------------------
-- 4) RLS
-- ----------------------------------------------------------------------------
alter table public.perfiles_usuario      enable row level security;
alter table public.ordenes_trabajo       enable row level security;
alter table public.inventario_materiales enable row level security;
alter table public.sistemas_trabajo      enable row level security;
alter table public.sistema_materiales    enable row level security;

-- El rol anónimo nunca debe leer datos
revoke all on public.perfiles_usuario      from anon;
revoke all on public.ordenes_trabajo       from anon;
revoke all on public.inventario_materiales from anon;
revoke all on public.sistemas_trabajo      from anon;
revoke all on public.sistema_materiales    from anon;

-- El rol autenticado necesita permisos de tabla; RLS es quien filtra las filas.
grant select, insert, update, delete on public.perfiles_usuario      to authenticated;
grant select, insert, update, delete on public.ordenes_trabajo       to authenticated;
grant select, insert, update, delete on public.inventario_materiales to authenticated;
grant select, insert, update, delete on public.sistemas_trabajo      to authenticated;
grant select, insert, update, delete on public.sistema_materiales    to authenticated;

-- ---- perfiles_usuario -------------------------------------------------------
drop policy if exists "perfiles_select" on public.perfiles_usuario;
create policy "perfiles_select" on public.perfiles_usuario
  for select to authenticated
  using (id = auth.uid() or public.es_admin() or public.es_jefe());

drop policy if exists "perfiles_insert" on public.perfiles_usuario;
create policy "perfiles_insert" on public.perfiles_usuario
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "perfiles_update" on public.perfiles_usuario;
create policy "perfiles_update" on public.perfiles_usuario
  for update to authenticated
  using (id = auth.uid() or public.es_admin())
  with check (id = auth.uid() or public.es_admin());

drop policy if exists "perfiles_delete" on public.perfiles_usuario;
create policy "perfiles_delete" on public.perfiles_usuario
  for delete to authenticated
  using (public.es_admin());

-- ---- ordenes_trabajo --------------------------------------------------------
-- Todos ven el tablero; solo quien corresponde puede mover la orden.
drop policy if exists "ordenes_select" on public.ordenes_trabajo;
create policy "ordenes_select" on public.ordenes_trabajo
  for select to authenticated
  using (true);

drop policy if exists "ordenes_insert" on public.ordenes_trabajo;
create policy "ordenes_insert" on public.ordenes_trabajo
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "ordenes_update" on public.ordenes_trabajo;
create policy "ordenes_update" on public.ordenes_trabajo
  for update to authenticated
  using (
    public.es_admin()
    or public.es_jefe()
    or (public.es_instalador() and (instalador_id is null or instalador_id = auth.uid()))
    or public.es_taller()
  )
  with check (
    public.es_admin()
    or public.es_jefe()
    or (public.es_instalador() and (instalador_id is null or instalador_id = auth.uid()))
    or public.es_taller()
  );

drop policy if exists "ordenes_delete" on public.ordenes_trabajo;
create policy "ordenes_delete" on public.ordenes_trabajo
  for delete to authenticated
  using (public.es_admin());

-- ---- inventario_materiales --------------------------------------------------
drop policy if exists "inventario_select" on public.inventario_materiales;
create policy "inventario_select" on public.inventario_materiales
  for select to authenticated
  using (true);

drop policy if exists "inventario_write" on public.inventario_materiales;
create policy "inventario_write" on public.inventario_materiales
  for all to authenticated
  using (public.es_admin() or public.es_jefe() or public.es_bodega())
  with check (public.es_admin() or public.es_jefe() or public.es_bodega());

-- ---- sistemas_trabajo -------------------------------------------------------
drop policy if exists "sistemas_select" on public.sistemas_trabajo;
create policy "sistemas_select" on public.sistemas_trabajo
  for select to authenticated
  using (true);

drop policy if exists "sistemas_write" on public.sistemas_trabajo;
create policy "sistemas_write" on public.sistemas_trabajo
  for all to authenticated
  using (public.es_admin() or public.es_jefe() or public.es_taller())
  with check (public.es_admin() or public.es_jefe() or public.es_taller());

-- ---- sistema_materiales -----------------------------------------------------
drop policy if exists "sistema_materiales_select" on public.sistema_materiales;
create policy "sistema_materiales_select" on public.sistema_materiales
  for select to authenticated
  using (true);

drop policy if exists "sistema_materiales_write" on public.sistema_materiales;
create policy "sistema_materiales_write" on public.sistema_materiales
  for all to authenticated
  using (public.es_admin() or public.es_jefe() or public.es_taller())
  with check (public.es_admin() or public.es_jefe() or public.es_taller());


-- ----------------------------------------------------------------------------
-- 5) PRIMER ADMINISTRADOR (bootstrap)
--    Las políticas exigen ser admin para insertar perfiles, así que la primera
--    cuenta debe promoverse manualmente una sola vez.
--    1. Crea el usuario desde Authentication -> Users (email: <documento>@yikevstratos.local,
--       con "Auto Confirm User" activo) o desde la app con el formulario de Colaboradores.
--    2. Reemplaza el documento y ejecuta:
--
--    insert into public.perfiles_usuario (id, nombre_completo, documento_id, rol)
--    select u.id, 'Administrador', '0000000000', 'Super Admin'
--    from auth.users u
--    where u.email = '0000000000@yikevstratos.local'
--    on conflict (id) do update set rol = excluded.rol;
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 6) [OPCIONAL — una sola vez] Alinear emails de Auth con el documento
--    Corrige las cuentas creadas con el prefijo antiguo `colab_`.
--    Ejecútalo si ya tienes usuarios en Authentication -> Users.
-- ----------------------------------------------------------------------------
/*
do $$
declare
  r record;
begin
  for r in
    select u.id as user_id, p.documento_id as documento
    from auth.users u
    join public.perfiles_usuario p on p.id = u.id
    where p.documento_id is not null
      and p.documento_id <> ''
      and u.email <> p.documento_id || '@yikevstratos.local'
  loop
    update auth.users
       set email = r.documento || '@yikevstratos.local',
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = r.user_id;

    update auth.identities
       set provider_id = r.documento || '@yikevstratos.local',
           identity_data = jsonb_set(
             coalesce(identity_data, '{}'::jsonb),
             '{email}',
             to_jsonb(r.documento || '@yikevstratos.local'::text)
           ),
           updated_at = now()
     where user_id = r.user_id and provider = 'email';
  end loop;
end
$$;
*/


-- ----------------------------------------------------------------------------
-- 7) [OPCIONAL — último paso] Eliminar la contraseña en texto plano
--    Ejecuta SOLO cuando confirmes que todos los colaboradores ya inician
--    sesión con Supabase Auth. Antes, haz un respaldo de la tabla.
-- ----------------------------------------------------------------------------
-- alter table public.perfiles_usuario drop column if exists password;
