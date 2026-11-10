-- ============================================================================
-- YiKev Stratos ERP - Scripts pendientes para Supabase
-- Ejecuta este archivo COMPLETO en el SQL Editor del proyecto
-- lctgnurjflnzvlwgdtmi. Es idempotente.
--
-- Incluye:
--   1) Migracion 006: salidas/entradas de herramientas e historial
--   2) Migracion 007: kits de herramientas por rol
-- ============================================================================

-- ============================================================================
-- YiKev Stratos ERP — Migración 006
-- Salidas y entradas de herramientas con historial de movimientos.
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001 a la 005, en el SQL Editor del proyecto
--     correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede ejecutar
--     varias veces sin perder datos.
--
-- Contenido:
--   1) Tabla public.herramienta_movimientos: una fila por herramienta y por
--      movimiento (salida o entrada), agrupadas por lote para formar el acta.
--   2) Columna herramientas en herramienta_registros para dejar en la firma
--      del checklist qué herramientas salieron o entraron.
--   3) Políticas RLS: el jefe/admin registra movimientos; cada colaborador
--      puede ver los suyos; producción/instalación puede firmar los propios.
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
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_jefe'
  ) then
    raise exception 'Falta la migración 001: no existe la función public.es_jefe().';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Historial de movimientos de herramientas
-- ----------------------------------------------------------------------------
create table if not exists public.herramienta_movimientos (
  id uuid primary key default gen_random_uuid(),
  -- Lote: agrupa todas las herramientas que salieron o entraron en un mismo acto.
  lote_id uuid not null default gen_random_uuid(),
  herramienta_id uuid references public.herramientas (id) on delete set null,
  herramienta_nombre text not null,
  herramienta_codigo text,
  colaborador_id uuid references public.perfiles_usuario (id) on delete set null,
  colaborador_nombre text,
  tipo text not null default 'salida',
  estado_anterior text,
  estado_nuevo text,
  orden_id uuid references public.ordenes_trabajo (id) on delete set null,
  registro_id uuid references public.herramienta_registros (id) on delete set null,
  novedad text,
  registrado_por uuid references public.perfiles_usuario (id) on delete set null,
  registrado_por_nombre text,
  creado_en timestamptz not null default now(),
  constraint herramienta_movimientos_tipo_check check (tipo in ('salida', 'entrada'))
);

create index if not exists herramienta_movimientos_herramienta_idx
  on public.herramienta_movimientos (herramienta_id, creado_en desc);
create index if not exists herramienta_movimientos_colaborador_idx
  on public.herramienta_movimientos (colaborador_id, creado_en desc);
create index if not exists herramienta_movimientos_lote_idx
  on public.herramienta_movimientos (lote_id);
create index if not exists herramienta_movimientos_orden_idx
  on public.herramienta_movimientos (orden_id);

alter table public.herramienta_movimientos enable row level security;
revoke all on public.herramienta_movimientos from anon;
grant select, insert, update, delete on public.herramienta_movimientos to authenticated;

drop policy if exists "herramienta_movimientos_select" on public.herramienta_movimientos;
create policy "herramienta_movimientos_select" on public.herramienta_movimientos
  for select to authenticated
  using (public.es_admin() or public.es_jefe() or colaborador_id = auth.uid());

drop policy if exists "herramienta_movimientos_insert" on public.herramienta_movimientos;
create policy "herramienta_movimientos_insert" on public.herramienta_movimientos
  for insert to authenticated
  with check (public.es_admin() or public.es_jefe() or colaborador_id = auth.uid());

drop policy if exists "herramienta_movimientos_delete" on public.herramienta_movimientos;
create policy "herramienta_movimientos_delete" on public.herramienta_movimientos
  for delete to authenticated
  using (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 2) Herramientas incluidas en la firma del checklist
-- ----------------------------------------------------------------------------
alter table public.herramienta_registros
  add column if not exists herramientas jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'herramienta_registros_herramientas_check'
      and conrelid = 'public.herramienta_registros'::regclass
  ) then
    alter table public.herramienta_registros
      add constraint herramienta_registros_herramientas_check
      check (jsonb_typeof(herramientas) = 'array');
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3) Listo
-- ----------------------------------------------------------------------------
select 'Migración 006 aplicada: movimientos de herramientas y actas de salida/entrada listos' as resultado;


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
