-- ============================================================================
-- YiKev Stratos ERP — Migración 007
-- Kits de herramientas por rol (producción, instalación, bodega).
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001 a la 006, en el SQL Editor del proyecto
--     correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede ejecutar
--     varias veces sin perder datos.
--
-- Contenido:
--   1) Tabla public.herramienta_kits: plantillas de herramientas recomendadas
--      para cada área de trabajo.
--   2) RLS: todo el personal autenticado consulta; jefe/admin administra.
--   3) Kits base de Producción e Instalación (solo si no existen).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Seguridad: verificar que estamos en el proyecto correcto.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'herramientas'
  ) then
    raise exception 'Falta la migración 005: no existe public.herramientas.';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'herramienta_movimientos'
  ) then
    raise exception 'Falta la migración 006: no existe public.herramienta_movimientos.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Kits de herramientas por rol
-- ----------------------------------------------------------------------------
create table if not exists public.herramienta_kits (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rol_destino text not null default 'instalador',
  descripcion text,
  -- Cada elemento: { "nombre": "Taladro", "cantidad": 1 }
  items jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint herramienta_kits_rol_check
    check (rol_destino in ('produccion', 'instalador', 'bodega', 'otro')),
  constraint herramienta_kits_items_check check (jsonb_typeof(items) = 'array')
);

create unique index if not exists herramienta_kits_nombre_rol_idx
  on public.herramienta_kits (lower(nombre), rol_destino);

alter table public.herramienta_kits enable row level security;
revoke all on public.herramienta_kits from anon;
grant select, insert, update, delete on public.herramienta_kits to authenticated;

drop policy if exists "herramienta_kits_select" on public.herramienta_kits;
create policy "herramienta_kits_select" on public.herramienta_kits
  for select to authenticated using (true);

drop policy if exists "herramienta_kits_write" on public.herramienta_kits;
create policy "herramienta_kits_write" on public.herramienta_kits
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 2) Kits base (solo si no existen)
-- ----------------------------------------------------------------------------
insert into public.herramienta_kits (nombre, rol_destino, descripcion, items)
select 'Kit de producción', 'produccion',
       'Herramientas base para corte, ensamble y armado en el taller.',
       '[
         {"nombre": "Taladro", "cantidad": 1},
         {"nombre": "Amoladora", "cantidad": 1},
         {"nombre": "Nivel", "cantidad": 1},
         {"nombre": "Cinta métrica", "cantidad": 1},
         {"nombre": "Juego de llaves", "cantidad": 1}
       ]'::jsonb
where not exists (
  select 1 from public.herramienta_kits
  where lower(nombre) = lower('Kit de producción') and rol_destino = 'produccion'
);

insert into public.herramienta_kits (nombre, rol_destino, descripcion, items)
select 'Kit de instalación', 'instalador',
       'Herramientas y seguridad para la salida a instalación en sitio.',
       '[
         {"nombre": "Taladro", "cantidad": 1},
         {"nombre": "Nivel", "cantidad": 1},
         {"nombre": "Cinta métrica", "cantidad": 1},
         {"nombre": "Arnés", "cantidad": 1},
         {"nombre": "Juego de llaves", "cantidad": 1}
       ]'::jsonb
where not exists (
  select 1 from public.herramienta_kits
  where lower(nombre) = lower('Kit de instalación') and rol_destino = 'instalador'
);

-- ----------------------------------------------------------------------------
-- 3) Listo
-- ----------------------------------------------------------------------------
select 'Migración 007 aplicada: kits de herramientas por rol listos' as resultado;
