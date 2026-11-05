-- ============================================================================
-- YiKev Stratos ERP — Migración 005
-- Producción ampliada, despiece de materiales, herramientas, checklists,
-- inventario de producción y notificaciones internas.
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001, 002, 003 y 004, en el SQL Editor del
--     proyecto correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede
--     ejecutar varias veces sin perder datos.
--
-- Contenido:
--   1) Nuevos campos de la orden: origen, responsable de producción, fotos del
--      producto terminado, despiece calculado y control de medidas de vidrio.
--   2) Ítems de una orden (varios proyectos/ventanas para un mismo cliente).
--   3) Medidas de vidrio enviadas por producción al jefe de taller.
--   4) Notificaciones por usuario y por rol.
--   5) Catálogo/asignación de herramientas, plantillas de checklist y registros.
--   6) Inventario propio de producción.
--   7) Recetas ampliadas: tipo de pieza, fórmula de corte, descuentos y merma.
--   8) Permisos de inserción de órdenes para el jefe de taller.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Seguridad: verificar que estamos en el proyecto correcto.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ordenes_trabajo'
  ) then
    raise exception 'Proyecto equivocado: no existe public.ordenes_trabajo. Abre el proyecto lctgnurjflnzvlwgdtmi.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_taller'
  ) then
    raise exception 'Falta la migración 001: no existe la función public.es_taller().';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1) Función de categoría de rol (para notificaciones por grupo)
-- ----------------------------------------------------------------------------
create or replace function public.categoria_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(rol) like '%admin%' or lower(rol) like '%gerencia%' or lower(rol) like '%super%' then 'admin'
    when lower(rol) like '%jefe%' then 'jefe'
    when lower(rol) like '%producci%' or lower(rol) like '%taller%' or lower(rol) like '%vidriero%' then 'produccion'
    when lower(rol) like '%instalador%' then 'instalador'
    when lower(rol) like '%bodega%' or lower(rol) like '%almac%' then 'bodega'
    else 'otro'
  end
  from public.perfiles_usuario
  where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 2) Ampliación de la orden de trabajo
-- ----------------------------------------------------------------------------
alter table public.ordenes_trabajo add column if not exists grupo_id uuid;
alter table public.ordenes_trabajo add column if not exists origen text not null default 'medicion';
alter table public.ordenes_trabajo add column if not exists produccion_id uuid references public.perfiles_usuario (id) on delete set null;
alter table public.ordenes_trabajo add column if not exists produccion_nombre text;
alter table public.ordenes_trabajo add column if not exists aceptada_en timestamptz;
alter table public.ordenes_trabajo add column if not exists terminado_en timestamptz;
alter table public.ordenes_trabajo add column if not exists fotos_terminado text[] not null default '{}';
alter table public.ordenes_trabajo add column if not exists despiece jsonb not null default '[]'::jsonb;
alter table public.ordenes_trabajo add column if not exists despiece_generado_en timestamptz;
alter table public.ordenes_trabajo add column if not exists despiece_generado_por text;
alter table public.ordenes_trabajo add column if not exists medidas_vidrio_enviadas_en timestamptz;
alter table public.ordenes_trabajo add column if not exists notas_produccion text;

create index if not exists ordenes_trabajo_produccion_id_idx
  on public.ordenes_trabajo (produccion_id);
create index if not exists ordenes_trabajo_grupo_id_idx
  on public.ordenes_trabajo (grupo_id);

-- ----------------------------------------------------------------------------
-- 3) Ítems de la orden: cada ventana, puerta o proyecto del mismo cliente.
-- ----------------------------------------------------------------------------
create table if not exists public.orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo (id) on delete cascade,
  sistema_id uuid references public.sistemas_trabajo (id) on delete set null,
  sistema_nombre text,
  descripcion text not null default 'Proyecto',
  tipo_trabajo text,
  ancho_cm numeric not null default 0,
  alto_cm numeric not null default 0,
  cantidad integer not null default 1,
  vidrio_tipo text,
  vidrio_espesor text,
  color text,
  observaciones text,
  orden integer not null default 0,
  creado_en timestamptz not null default now()
);

create index if not exists orden_items_orden_id_idx
  on public.orden_items (orden_id);

alter table public.orden_items enable row level security;
revoke all on public.orden_items from anon;
grant select, insert, update, delete on public.orden_items to authenticated;

drop policy if exists "orden_items_select" on public.orden_items;
create policy "orden_items_select" on public.orden_items
  for select to authenticated using (true);

drop policy if exists "orden_items_write" on public.orden_items;
create policy "orden_items_write" on public.orden_items
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 4) Medidas de vidrio enviadas por producción al jefe de taller
-- ----------------------------------------------------------------------------
create table if not exists public.orden_vidrios (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo (id) on delete cascade,
  item_id uuid references public.orden_items (id) on delete cascade,
  descripcion text,
  ancho_cm numeric not null default 0,
  alto_cm numeric not null default 0,
  cantidad integer not null default 1,
  espesor text,
  tipo text,
  observaciones text,
  enviado_por uuid references public.perfiles_usuario (id) on delete set null,
  enviado_por_nombre text,
  creado_en timestamptz not null default now()
);

create index if not exists orden_vidrios_orden_id_idx
  on public.orden_vidrios (orden_id);

alter table public.orden_vidrios enable row level security;
revoke all on public.orden_vidrios from anon;
grant select, insert, update, delete on public.orden_vidrios to authenticated;

drop policy if exists "orden_vidrios_select" on public.orden_vidrios;
create policy "orden_vidrios_select" on public.orden_vidrios
  for select to authenticated using (true);

drop policy if exists "orden_vidrios_write" on public.orden_vidrios;
create policy "orden_vidrios_write" on public.orden_vidrios
  for all to authenticated
  using (public.es_admin() or public.es_jefe() or public.es_taller())
  with check (public.es_admin() or public.es_jefe() or public.es_taller());

-- ----------------------------------------------------------------------------
-- 5) Notificaciones internas
--    `usuario_id` apunta a una persona; `rol_destino` a un grupo entero.
-- ----------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.perfiles_usuario (id) on delete cascade,
  rol_destino text,
  orden_id uuid references public.ordenes_trabajo (id) on delete cascade,
  tipo text not null default 'info',
  titulo text not null,
  mensaje text,
  leida boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists notificaciones_usuario_idx
  on public.notificaciones (usuario_id, leida, creado_en desc);
create index if not exists notificaciones_rol_idx
  on public.notificaciones (rol_destino, leida, creado_en desc);

alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from anon;
grant select, insert, update, delete on public.notificaciones to authenticated;

drop policy if exists "notificaciones_select" on public.notificaciones;
create policy "notificaciones_select" on public.notificaciones
  for select to authenticated
  using (
    public.es_admin()
    or public.es_jefe()
    or usuario_id = auth.uid()
    or (rol_destino = 'produccion' and public.es_taller())
    or (rol_destino = 'instalador' and public.es_instalador())
    or (rol_destino = 'bodega' and public.es_bodega())
    or rol_destino = 'todos'
  );

drop policy if exists "notificaciones_insert" on public.notificaciones;
create policy "notificaciones_insert" on public.notificaciones
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "notificaciones_update" on public.notificaciones;
create policy "notificaciones_update" on public.notificaciones
  for update to authenticated
  using (
    public.es_admin()
    or public.es_jefe()
    or usuario_id = auth.uid()
    or (rol_destino = 'produccion' and public.es_taller())
    or (rol_destino = 'instalador' and public.es_instalador())
    or (rol_destino = 'bodega' and public.es_bodega())
    or rol_destino = 'todos'
  )
  with check (true);

drop policy if exists "notificaciones_delete" on public.notificaciones;
create policy "notificaciones_delete" on public.notificaciones
  for delete to authenticated
  using (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 6) Herramientas: catálogo y asignación a colaboradores
-- ----------------------------------------------------------------------------
create table if not exists public.herramientas (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nombre text not null,
  categoria text not null default 'Herramienta menor',
  descripcion text,
  estado text not null default 'Disponible',
  colaborador_id uuid references public.perfiles_usuario (id) on delete set null,
  colaborador_nombre text,
  asignado_por uuid references public.perfiles_usuario (id) on delete set null,
  asignado_por_nombre text,
  asignado_en timestamptz,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists herramientas_colaborador_idx
  on public.herramientas (colaborador_id);

alter table public.herramientas enable row level security;
revoke all on public.herramientas from anon;
grant select, insert, update, delete on public.herramientas to authenticated;

drop policy if exists "herramientas_select" on public.herramientas;
create policy "herramientas_select" on public.herramientas
  for select to authenticated using (true);

drop policy if exists "herramientas_write" on public.herramientas;
create policy "herramientas_write" on public.herramientas
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 7) Plantillas de checklist y registros de salida / entrada
-- ----------------------------------------------------------------------------
create table if not exists public.herramienta_checklists (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'salida',
  items jsonb not null default '[]'::jsonb,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint herramienta_checklists_tipo_check check (tipo in ('salida', 'entrada')),
  constraint herramienta_checklists_items_check check (jsonb_typeof(items) = 'array')
);

alter table public.herramienta_checklists enable row level security;
revoke all on public.herramienta_checklists from anon;
grant select, insert, update, delete on public.herramienta_checklists to authenticated;

drop policy if exists "herramienta_checklists_select" on public.herramienta_checklists;
create policy "herramienta_checklists_select" on public.herramienta_checklists
  for select to authenticated using (true);

drop policy if exists "herramienta_checklists_write" on public.herramienta_checklists;
create policy "herramienta_checklists_write" on public.herramienta_checklists
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

create table if not exists public.herramienta_registros (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.perfiles_usuario (id) on delete cascade,
  colaborador_nombre text,
  orden_id uuid references public.ordenes_trabajo (id) on delete set null,
  checklist_id uuid references public.herramienta_checklists (id) on delete set null,
  checklist_nombre text,
  tipo text not null default 'salida',
  items jsonb not null default '[]'::jsonb,
  novedad text,
  creado_en timestamptz not null default now(),
  constraint herramienta_registros_tipo_check check (tipo in ('salida', 'entrada')),
  constraint herramienta_registros_items_check check (jsonb_typeof(items) = 'array')
);

create index if not exists herramienta_registros_colaborador_idx
  on public.herramienta_registros (colaborador_id, creado_en desc);
create index if not exists herramienta_registros_orden_idx
  on public.herramienta_registros (orden_id);

alter table public.herramienta_registros enable row level security;
revoke all on public.herramienta_registros from anon;
grant select, insert, update, delete on public.herramienta_registros to authenticated;

drop policy if exists "herramienta_registros_select" on public.herramienta_registros;
create policy "herramienta_registros_select" on public.herramienta_registros
  for select to authenticated
  using (public.es_admin() or public.es_jefe() or colaborador_id = auth.uid());

drop policy if exists "herramienta_registros_insert" on public.herramienta_registros;
create policy "herramienta_registros_insert" on public.herramienta_registros
  for insert to authenticated
  with check (public.es_admin() or public.es_jefe() or colaborador_id = auth.uid());

drop policy if exists "herramienta_registros_delete" on public.herramienta_registros;
create policy "herramienta_registros_delete" on public.herramienta_registros
  for delete to authenticated
  using (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 8) Inventario de producción (insumos y consumibles del taller)
-- ----------------------------------------------------------------------------
create table if not exists public.inventario_produccion (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Insumos de producción',
  unidad_medida text not null default 'Unidad',
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  ubicacion text,
  colaborador_id uuid references public.perfiles_usuario (id) on delete set null,
  colaborador_nombre text,
  notas text,
  creado_por uuid references public.perfiles_usuario (id) on delete set null,
  creado_por_nombre text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists inventario_produccion_colaborador_idx
  on public.inventario_produccion (colaborador_id);

alter table public.inventario_produccion enable row level security;
revoke all on public.inventario_produccion from anon;
grant select, insert, update, delete on public.inventario_produccion to authenticated;

drop policy if exists "inventario_produccion_select" on public.inventario_produccion;
create policy "inventario_produccion_select" on public.inventario_produccion
  for select to authenticated
  using (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  );

drop policy if exists "inventario_produccion_write" on public.inventario_produccion;
create policy "inventario_produccion_write" on public.inventario_produccion
  for all to authenticated
  using (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  )
  with check (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  );

-- ----------------------------------------------------------------------------
-- 9) Recetas ampliadas: piezas, fórmulas de corte, descuentos y merma
-- ----------------------------------------------------------------------------
alter table public.sistemas_trabajo add column if not exists tipo text not null default 'corrediza';
alter table public.sistemas_trabajo add column if not exists descuento_vidrio_ancho_mm numeric not null default 30;
alter table public.sistemas_trabajo add column if not exists descuento_vidrio_alto_mm numeric not null default 30;
alter table public.sistemas_trabajo add column if not exists descuento_perfil_ancho_mm numeric not null default 0;
alter table public.sistemas_trabajo add column if not exists descuento_perfil_alto_mm numeric not null default 0;
alter table public.sistemas_trabajo add column if not exists merma_porcentaje numeric not null default 5;

alter table public.sistema_materiales add column if not exists tipo_pieza text;
alter table public.sistema_materiales add column if not exists formula_largo text;
alter table public.sistema_materiales add column if not exists descuento_mm numeric not null default 0;
alter table public.sistema_materiales add column if not exists merma_porcentaje numeric not null default 0;
alter table public.sistema_materiales add column if not exists es_vidrio boolean not null default false;
alter table public.sistema_materiales add column if not exists orden integer not null default 0;

-- Completa la metadata de las recetas que ya existían. No toca filas que el
-- administrador ya haya configurado (tipo_pieza no nulo).
update public.sistema_materiales sm
set
  tipo_pieza = case
    when m.categoria = 'Vidrio y Cristales' then 'vidrio'
    when m.categoria = 'Accesorios y Herrajes' then 'accesorio'
    when m.categoria = 'Empaques y Sellantes' then 'empaque'
    else 'perfil'
  end,
  formula_largo = case
    when m.categoria in ('Perfiles de Aluminio', 'Acrílicos y PVC') then 'perimetro'
    else 'fijo'
  end,
  es_vidrio = (m.categoria = 'Vidrio y Cristales'),
  merma_porcentaje = case
    when m.categoria in ('Perfiles de Aluminio', 'Vidrio y Cristales') then 5
    else 0
  end
from public.inventario_materiales m
where sm.material_id = m.id
  and sm.tipo_pieza is null;

alter table public.sistema_materiales alter column tipo_pieza set default 'accesorio';
alter table public.sistema_materiales alter column formula_largo set default 'fijo';

create index if not exists sistema_materiales_orden_idx
  on public.sistema_materiales (sistema_id, orden);

-- ----------------------------------------------------------------------------
-- 10) Permisos: el jefe de taller también crea órdenes y administra recetas
-- ----------------------------------------------------------------------------
drop policy if exists "ordenes_insert" on public.ordenes_trabajo;
create policy "ordenes_insert" on public.ordenes_trabajo
  for insert to authenticated
  with check (public.es_admin() or public.es_jefe());

-- Las recetas y los sistemas los administran el super admin y el jefe de taller.
drop policy if exists "sistemas_write" on public.sistemas_trabajo;
create policy "sistemas_write" on public.sistemas_trabajo
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "sistema_materiales_write" on public.sistema_materiales;
create policy "sistema_materiales_write" on public.sistema_materiales
  for all to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

-- ----------------------------------------------------------------------------
-- 11) Plantillas de checklist de demostración (idempotente)
-- ----------------------------------------------------------------------------
insert into public.herramienta_checklists (nombre, tipo, items)
select 'Salida a instalación', 'salida', '[
  "Taladro y baterías cargadas",
  "Nivel, escuadra y cinta métrica",
  "Herramientas de mano completas",
  "Silicona, empaques y consumibles",
  "Elementos de seguridad (guantes, gafas)",
  "Orden de trabajo y dirección del cliente"
]'::jsonb
where not exists (
  select 1 from public.herramienta_checklists where nombre = 'Salida a instalación'
);

insert into public.herramienta_checklists (nombre, tipo, items)
select 'Entrada al taller', 'entrada', '[
  "Todas las herramientas fueron devueltas",
  "Herramientas limpias y en buen estado",
  "Se reportaron daños o pérdidas",
  "Consumibles sobrantes entregados",
  "Área de trabajo organizada",
  "Novedades del trabajo reportadas"
]'::jsonb
where not exists (
  select 1 from public.herramienta_checklists where nombre = 'Entrada al taller'
);

-- ----------------------------------------------------------------------------
-- 12) Refrescar la caché de PostgREST
-- ----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 13) Comprobación final
-- ----------------------------------------------------------------------------
select 'Migración 005 aplicada: producción, despiece, herramientas, checklists, inventario y notificaciones listos' as resultado;
