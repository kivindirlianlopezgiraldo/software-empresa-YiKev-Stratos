-- ============================================================================
-- YiKev Stratos ERP — Migración 003
-- Administración completa de empleados + datos de la empresa
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001 y la 002, en el SQL Editor del proyecto
--     correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede ejecutar
--     varias veces sin perder datos.
--
-- Contenido:
--   1) Datos ampliados de cada colaborador (contrato, seguridad social,
--      contacto de emergencia, dotación, notas).
--   2) Tabla pública `empresa_config` de una sola fila con los datos de la
--      empresa (NIT, contactos, banco, representante legal, etc.).
--   3) RLS: solo el rol administrador puede escribir; todo el personal
--      autenticado puede leer la información de la empresa.
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
end $$;

-- ----------------------------------------------------------------------------
-- 1) Datos ampliados del colaborador
-- ----------------------------------------------------------------------------
alter table public.perfiles_usuario add column if not exists fecha_nacimiento date;
alter table public.perfiles_usuario add column if not exists email_personal text;
alter table public.perfiles_usuario add column if not exists direccion text;
alter table public.perfiles_usuario add column if not exists ciudad text;
alter table public.perfiles_usuario add column if not exists fecha_ingreso date;
alter table public.perfiles_usuario add column if not exists eps text;
alter table public.perfiles_usuario add column if not exists arl text;
alter table public.perfiles_usuario add column if not exists contacto_emergencia_nombre text;
alter table public.perfiles_usuario add column if not exists contacto_emergencia_telefono text;
alter table public.perfiles_usuario add column if not exists talla_camisa text;
alter table public.perfiles_usuario add column if not exists talla_pantalon text;
alter table public.perfiles_usuario add column if not exists talla_calzado text;
alter table public.perfiles_usuario add column if not exists notas text;

create index if not exists perfiles_usuario_activo_idx
  on public.perfiles_usuario (activo);

-- ----------------------------------------------------------------------------
-- 2) Protección de campos sensibles
--    El propio colaborador puede editar su nombre/teléfono, pero el contrato,
--    el salario y los datos laborales solo los cambia un administrador.
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
     or new.fecha_ingreso is distinct from old.fecha_ingreso
     or new.documento_id is distinct from old.documento_id
     or new.activo is distinct from old.activo then
    raise exception 'No tienes permiso para modificar rol, salario, contrato, departamento ni documento.';
  end if;

  return new;
end
$$;

drop trigger if exists tr_proteger_campos_perfil on public.perfiles_usuario;
create trigger tr_proteger_campos_perfil
  before update on public.perfiles_usuario
  for each row execute function public.proteger_campos_perfil();

-- ----------------------------------------------------------------------------
-- 3) Configuración de la empresa (una sola fila, id = 1)
-- ----------------------------------------------------------------------------
create table if not exists public.empresa_config (
  id integer primary key default 1 check (id = 1),
  nombre_comercial text not null default 'YiKev Stratos',
  razon_social text,
  nit text,
  digito_verificacion text,
  regimen_tributario text,
  actividad_economica text,
  direccion text,
  ciudad text default 'Quibdó',
  departamento_geografico text default 'Chocó',
  telefono text,
  celular text,
  email text,
  sitio_web text,
  horario text,
  representante_legal text,
  documento_representante text,
  banco text,
  tipo_cuenta text,
  numero_cuenta text,
  titular_cuenta text,
  notas text,
  actualizado_en timestamptz not null default now(),
  actualizado_por text
);

-- Fila única: evita que la aplicación tenga que decidir cuál configuración usar.
insert into public.empresa_config (id, nombre_comercial, ciudad, departamento_geografico)
values (1, 'YiKev Stratos', 'Quibdó', 'Chocó')
on conflict (id) do nothing;

create or replace function public.marcar_empresa_actualizada()
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

drop trigger if exists tr_empresa_actualizada on public.empresa_config;
create trigger tr_empresa_actualizada
  before update on public.empresa_config
  for each row execute function public.marcar_empresa_actualizada();

-- ----------------------------------------------------------------------------
-- 4) RLS de la empresa
-- ----------------------------------------------------------------------------
alter table public.empresa_config enable row level security;

revoke all on public.empresa_config from anon;
grant select, insert, update, delete on public.empresa_config to authenticated;

drop policy if exists "empresa_select" on public.empresa_config;
create policy "empresa_select" on public.empresa_config
  for select to authenticated
  using (true);

drop policy if exists "empresa_insert" on public.empresa_config;
create policy "empresa_insert" on public.empresa_config
  for insert to authenticated
  with check (public.es_admin());

drop policy if exists "empresa_update" on public.empresa_config;
create policy "empresa_update" on public.empresa_config
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "empresa_delete" on public.empresa_config;
create policy "empresa_delete" on public.empresa_config
  for delete to authenticated
  using (public.es_admin());

-- ----------------------------------------------------------------------------
-- 5) Vista pública de la empresa (para la landing page)
--    Expone SOLO datos de contacto e identidad comercial. Nunca banco,
--    representante legal ni documento del representante.
-- ----------------------------------------------------------------------------
create or replace view public.empresa_publica as
select
  id,
  nombre_comercial,
  razon_social,
  nit,
  digito_verificacion,
  direccion,
  ciudad,
  departamento_geografico,
  telefono,
  celular,
  email,
  sitio_web,
  horario
from public.empresa_config
where id = 1;

revoke all on public.empresa_publica from anon;
grant select on public.empresa_publica to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) Refrescar la caché de PostgREST para que las columnas nuevas
--    estén disponibles de inmediato en la API.
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 7) Comprobación final: el SQL Editor debe mostrar este mensaje.
-- ----------------------------------------------------------------------------
select 'Migración 003 aplicada: empleados ampliados, empresa_config y vista pública listos' as resultado;
