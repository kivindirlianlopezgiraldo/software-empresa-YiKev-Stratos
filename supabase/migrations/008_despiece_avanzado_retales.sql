-- ============================================================================
-- YiKev Stratos ERP — Migración 008
-- Despiece avanzado por sistema, barras de 595 cm, retales de producción y
-- plantillas de receta para el sistema 50/20 y la cabina de baño.
-- ============================================================================
--
-- ⚠️  Ejecuta esto DESPUÉS de la 001 a la 007, en el SQL Editor del proyecto
--     correcto (lctgnurjflnzvlwgdtmi). Es idempotente: se puede ejecutar
--     varias veces sin perder datos ni duplicar recetas.
--
-- Contenido:
--   1) Largo de barra configurable por sistema (595 cm por defecto).
--   2) Fórmula avanzada por línea de receta y ángulo de corte.
--   3) Tabla de retales disponibles en producción.
--   4) Plantillas de los sistemas 50/20 y cabina de baño.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Largo de barra comercial por sistema
-- ----------------------------------------------------------------------------
alter table public.sistemas_trabajo
  add column if not exists largo_barra_cm numeric not null default 595;

comment on column public.sistemas_trabajo.largo_barra_cm is
  'Largo real de la barra de perfil en centímetros. En este taller: 595 cm.';

-- ----------------------------------------------------------------------------
-- 2) Fórmula avanzada por pieza de la receta
--    formula_config = {
--      base: 'ancho' | 'alto' | 'ancho_mitad' | 'alto_mitad' | 'perimetro' |
--            'referencia' | 'fijo',
--      restarCm: número,
--      dividir: número,
--      referencia: texto de otra pieza,
--      angulo: grados
--    }
-- ----------------------------------------------------------------------------
alter table public.sistema_materiales
  add column if not exists formula_config jsonb not null default '{}'::jsonb;
alter table public.sistema_materiales
  add column if not exists angulo_corte numeric not null default 0;

comment on column public.sistema_materiales.formula_config is
  'Fórmula paramétrica: (base − restarCm − descuento_mm/10) ÷ dividir. Permite referenciar la medida de otra pieza.';
comment on column public.sistema_materiales.angulo_corte is
  'Ángulo de corte de la pieza en grados (ej. 5 para la jamba 50/20).';

-- ----------------------------------------------------------------------------
-- 3) Retales disponibles en producción
--    Cada fila puede representar varios retales iguales con `cantidad`.
--    El motor de despiece los consume antes de pedir barras nuevas.
-- ----------------------------------------------------------------------------
create table if not exists public.retales_produccion (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  material_id uuid references public.inventario_materiales (id) on delete set null,
  material_nombre text not null,
  color text not null default 'Sin definir',
  largo_cm numeric not null default 0 check (largo_cm >= 0),
  ancho_cm numeric not null default 0 check (ancho_cm >= 0),
  cantidad integer not null default 1 check (cantidad > 0),
  ubicacion text,
  disponible boolean not null default true,
  notas text,
  creado_por uuid references public.perfiles_usuario (id) on delete set null,
  creado_por_nombre text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists retales_produccion_material_idx
  on public.retales_produccion (material_nombre, color, disponible);
create index if not exists retales_produccion_disponible_idx
  on public.retales_produccion (disponible, largo_cm desc);

alter table public.retales_produccion enable row level security;
revoke all on public.retales_produccion from anon;
grant select, insert, update, delete on public.retales_produccion to authenticated;

drop policy if exists "retales_produccion_select" on public.retales_produccion;
create policy "retales_produccion_select" on public.retales_produccion
  for select to authenticated
  using (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  );

drop policy if exists "retales_produccion_write" on public.retales_produccion;
create policy "retales_produccion_write" on public.retales_produccion
  for all to authenticated
  using (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  )
  with check (
    public.es_admin() or public.es_jefe() or public.es_taller() or public.es_bodega()
  );

-- ----------------------------------------------------------------------------
-- 4) Plantillas de receta
--    Crea los materiales que falten y asocia las piezas a cada sistema.
--    No modifica una línea que ya exista para el mismo sistema/material.
-- ----------------------------------------------------------------------------
do $$
declare
  v_sistema uuid;
  v_material uuid;
  v_categoria text;
  v_unidad text;
  rec record;
begin
  -- ==========================================================================
  -- Sistema 50/20
  -- ==========================================================================
  select id into v_sistema
  from public.sistemas_trabajo
  where lower(nombre) = lower('Sistema 50/20')
  limit 1;

  if v_sistema is null then
    insert into public.sistemas_trabajo
      (nombre, linea, tipo, descripcion, largo_barra_cm,
       descuento_vidrio_ancho_mm, descuento_vidrio_alto_mm, merma_porcentaje)
    values
      ('Sistema 50/20', 'Línea 50/20', 'corrediza',
       'Ventana corrediza 50/20. Sillar y cabezal al ancho total; jamba alto −1.3 cm con corte a 5°; tope y enganche alto −3 cm; horizontal (ancho −2.8 cm) ÷ 4.',
       595, 30, 30, 5)
    returning id into v_sistema;
  end if;

  for rec in
    select * from (values
      -- nombre, tipo, base, restar_cm, dividir, cantidad, angulo, orden, referencia
      ('Sillar 50/20',      'perfil',    'ancho',      0,   1, 1, 0, 1, ''),
      ('Cabezal 50/20',     'perfil',    'ancho',      0,   1, 1, 0, 2, ''),
      ('Jamba 50/20',       'perfil',    'alto',       1.3, 1, 2, 5, 3, ''),
      ('Tope 50/20',        'perfil',    'alto',       3,   1, 2, 0, 4, ''),
      ('Enganche 50/20',    'perfil',    'alto',       3,   1, 2, 0, 5, ''),
      ('Horizontal 50/20',  'perfil',    'ancho',      2.8, 4, 4, 0, 6, ''),
      ('Seguro 50/20',      'accesorio', 'fijo',       0,   1, 1, 0, 7, ''),
      ('Rodachina 50/20',   'accesorio', 'fijo',       0,   1, 4, 0, 8, '')
    ) as t(nombre, tipo, base, restar_cm, dividir, cantidad, angulo, orden, referencia)
  loop
    v_categoria := case
      when rec.tipo = 'perfil' then 'Perfiles de Aluminio'
      when rec.tipo = 'accesorio' then 'Accesorios y Herrajes'
      else 'Vidrio y Cristales'
    end;
    v_unidad := case when rec.tipo = 'perfil' then 'Barra 595 cm' else 'Unidad' end;

    select id into v_material
    from public.inventario_materiales
    where lower(nombre) = lower(rec.nombre)
    limit 1;

    if v_material is null then
      insert into public.inventario_materiales
        (codigo_referencia, nombre, categoria, unidad_medida,
         stock_actual, stock_minimo, precio_costo, precio_venta)
      values
        ('TPL-' || left(md5(rec.nombre), 8), rec.nombre, v_categoria, v_unidad,
         0, 0, 0, 0)
      returning id into v_material;
    end if;

    insert into public.sistema_materiales
      (id, sistema_id, material_id, cantidad_requerida, tipo_pieza,
       formula_largo, formula_config, angulo_corte, merma_porcentaje, es_vidrio, orden)
    values
      (gen_random_uuid(), v_sistema, v_material, rec.cantidad, rec.tipo,
       rec.base,
       jsonb_build_object(
         'base', rec.base,
         'restarCm', rec.restar_cm,
         'dividir', rec.dividir,
         'referencia', rec.referencia,
         'angulo', rec.angulo
       ),
       rec.angulo,
       case when rec.tipo = 'perfil' then 5 else 0 end,
       false,
       rec.orden)
    on conflict (sistema_id, material_id) do nothing;
  end loop;

  -- ==========================================================================
  -- Cabina de baño
  -- ==========================================================================
  select id into v_sistema
  from public.sistemas_trabajo
  where lower(nombre) = lower('Cabina de Baño')
  limit 1;

  if v_sistema is null then
    insert into public.sistemas_trabajo
      (nombre, linea, tipo, descripcion, largo_barra_cm,
       descuento_vidrio_ancho_mm, descuento_vidrio_alto_mm, merma_porcentaje)
    values
      ('Cabina de Baño', 'División de Baño', 'division',
       'Cabina de baño. Cabezal y War 12 ancho al ancho total; War 12 alto −3 cm; PV17 fija alto −4.5 cm; PV17 corrediza alto −5.5 cm; PV17 ancho (ancho −1 cm) ÷ 2; barra toallera = PV17 ancho −9 cm.',
       595, 30, 30, 5)
    returning id into v_sistema;
  end if;

  for rec in
    select * from (values
      -- nombre, tipo, base, restar_cm, dividir, cantidad, angulo, orden, referencia
      ('Cabezal Cabina de Baño', 'perfil',    'ancho',      0,   1, 1, 0, 1, ''),
      ('War 12 Alto',            'perfil',    'alto',       3,   1, 2, 0, 2, ''),
      ('War 12 Ancho',           'perfil',    'ancho',      0,   1, 1, 0, 3, ''),
      ('PV17 Fija Alto',         'perfil',    'alto',       4.5, 1, 2, 0, 4, ''),
      ('PV17 Corrediza Alto',    'perfil',    'alto',       5.5, 1, 2, 0, 5, ''),
      ('PV17 Ancho',             'perfil',    'ancho',      1,   2, 4, 0, 6, ''),
      ('Barra Toallera',         'perfil',    'referencia', 9,   1, 2, 0, 7, 'PV17 Ancho'),
      ('Rodachina Cabina de Baño', 'accesorio', 'fijo',     0,   1, 2, 0, 8, ''),
      ('Jaladera Cabina de Baño',  'accesorio', 'fijo',     0,   1, 1, 0, 9, ''),
      ('Soporte Toallero',         'accesorio', 'fijo',     0,   1, 2, 0, 10, '')
    ) as t(nombre, tipo, base, restar_cm, dividir, cantidad, angulo, orden, referencia)
  loop
    v_categoria := case
      when rec.tipo = 'perfil' then 'Perfiles de Aluminio'
      when rec.tipo = 'accesorio' then 'Accesorios y Herrajes'
      else 'Vidrio y Cristales'
    end;
    v_unidad := case when rec.tipo = 'perfil' then 'Barra 595 cm' else 'Unidad' end;

    select id into v_material
    from public.inventario_materiales
    where lower(nombre) = lower(rec.nombre)
    limit 1;

    if v_material is null then
      insert into public.inventario_materiales
        (codigo_referencia, nombre, categoria, unidad_medida,
         stock_actual, stock_minimo, precio_costo, precio_venta)
      values
        ('TPL-' || left(md5(rec.nombre), 8), rec.nombre, v_categoria, v_unidad,
         0, 0, 0, 0)
      returning id into v_material;
    end if;

    insert into public.sistema_materiales
      (id, sistema_id, material_id, cantidad_requerida, tipo_pieza,
       formula_largo, formula_config, angulo_corte, merma_porcentaje, es_vidrio, orden)
    values
      (gen_random_uuid(), v_sistema, v_material, rec.cantidad, rec.tipo,
       rec.base,
       jsonb_build_object(
         'base', rec.base,
         'restarCm', rec.restar_cm,
         'dividir', rec.dividir,
         'referencia', rec.referencia,
         'angulo', rec.angulo
       ),
       rec.angulo,
       case when rec.tipo = 'perfil' then 5 else 0 end,
       false,
       rec.orden)
    on conflict (sistema_id, material_id) do nothing;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5) Verificación rápida (opcional)
-- ----------------------------------------------------------------------------
-- select s.nombre, s.largo_barra_cm, count(sm.id) as piezas
-- from public.sistemas_trabajo s
-- left join public.sistema_materiales sm on sm.sistema_id = s.id
-- where s.nombre in ('Sistema 50/20', 'Cabina de Baño')
-- group by s.id, s.nombre, s.largo_barra_cm;
