-- Salidas de instalación por orden con chequeos obligatorios de entrega y retorno.
-- Ejecutar después de las migraciones 001, 005, 006, 007 y 011.

do $$
begin
  if to_regclass('public.herramientas') is null
     or to_regclass('public.herramienta_kits') is null
     or to_regclass('public.herramienta_movimientos') is null
     or to_regclass('public.herramienta_registros') is null
     or to_regclass('public.ordenes_trabajo') is null
     or to_regclass('public.perfiles_usuario') is null then
    raise exception 'Faltan las migraciones 005, 006 o 007 para administrar kits de instalación.';
  end if;

  if to_regprocedure('public.es_admin()') is null
     or to_regprocedure('public.es_jefe()') is null then
    raise exception 'Falta la migración 001: no existen las funciones de permisos de admin y jefe.';
  end if;
end $$;

create table if not exists public.herramienta_instalaciones (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo (id) on delete restrict,
  instalador_id uuid not null references public.perfiles_usuario (id) on delete restrict,
  instalador_nombre text not null,
  kit_id uuid references public.herramienta_kits (id) on delete set null,
  kit_nombre text not null,
  herramientas jsonb not null,
  checklist_salida jsonb not null,
  checklist_salida_nombre text not null,
  checklist_retorno jsonb,
  checklist_retorno_nombre text,
  estado text not null default 'en_curso',
  observaciones_salida text,
  observaciones_retorno text,
  salida_en timestamptz not null default now(),
  retorno_en timestamptz,
  creado_por uuid references public.perfiles_usuario (id) on delete set null,
  creado_por_nombre text,
  constraint herramienta_instalaciones_herramientas_check
    check (jsonb_typeof(herramientas) = 'array' and jsonb_array_length(herramientas) > 0),
  constraint herramienta_instalaciones_salida_check
    check (jsonb_typeof(checklist_salida) = 'array' and jsonb_array_length(checklist_salida) > 0),
  constraint herramienta_instalaciones_retorno_check
    check (checklist_retorno is null or jsonb_typeof(checklist_retorno) = 'array'),
  constraint herramienta_instalaciones_estado_check
    check (estado in ('en_curso', 'finalizada')),
  constraint herramienta_instalaciones_fechas_check
    check (
      (estado = 'en_curso' and retorno_en is null)
      or (
        estado = 'finalizada'
        and retorno_en is not null
        and checklist_retorno is not null
        and checklist_retorno_nombre is not null
      )
    )
);

create index if not exists herramienta_instalaciones_estado_idx
  on public.herramienta_instalaciones (estado, salida_en desc);
create index if not exists herramienta_instalaciones_instalador_idx
  on public.herramienta_instalaciones (instalador_id, salida_en desc);
create index if not exists herramienta_instalaciones_orden_idx
  on public.herramienta_instalaciones (orden_id, salida_en desc);

alter table public.herramienta_instalaciones enable row level security;
revoke all on public.herramienta_instalaciones from anon, authenticated;
grant select on public.herramienta_instalaciones to authenticated;

drop policy if exists "herramienta_instalaciones_select" on public.herramienta_instalaciones;
create policy "herramienta_instalaciones_select" on public.herramienta_instalaciones
  for select to authenticated
  using (public.es_admin() or public.es_jefe() or instalador_id = auth.uid());

drop policy if exists "herramienta_instalaciones_write" on public.herramienta_instalaciones;

create or replace function public.iniciar_salida_instalacion(
  p_orden_id uuid,
  p_instalador_id uuid,
  p_kit_id uuid,
  p_herramientas_ids uuid[],
  p_checklist_salida jsonb,
  p_checklist_nombre text,
  p_novedad text,
  p_registrado_por_nombre text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instalador_nombre text;
  v_kit_nombre text;
  v_herramientas jsonb;
  v_instalacion_id uuid := gen_random_uuid();
  v_registro_id uuid := gen_random_uuid();
  v_cantidad integer;
begin
  if not (public.es_admin() or public.es_jefe()) then
    raise exception 'Solo el administrador o jefe de taller puede registrar salidas de instalación.';
  end if;

  if p_herramientas_ids is null or cardinality(p_herramientas_ids) = 0 then
    raise exception 'Selecciona al menos una herramienta para la instalación.';
  end if;

  if cardinality(p_herramientas_ids) <> (
    select count(distinct tool_id) from unnest(p_herramientas_ids) as items(tool_id)
  ) then
    raise exception 'La selección contiene herramientas repetidas.';
  end if;

  if p_checklist_salida is null or jsonb_typeof(p_checklist_salida) is distinct from 'array' then
    raise exception 'Selecciona un chequeo de salida válido.';
  end if;

  if jsonb_array_length(p_checklist_salida) = 0 or exists (
    select 1
    from jsonb_array_elements(p_checklist_salida) as items(item)
    where coalesce((item->>'marcado')::boolean, false) = false
  ) then
    raise exception 'Completa todos los puntos del chequeo de salida antes de continuar.';
  end if;

  select nombre_completo
  into v_instalador_nombre
  from public.perfiles_usuario
  where id = p_instalador_id
    and activo is distinct from false
    and lower(rol) like '%instalad%';

  if v_instalador_nombre is null then
    raise exception 'El instalador seleccionado no existe, está inactivo o no tiene rol de instalación.';
  end if;

  if not exists (select 1 from public.ordenes_trabajo where id = p_orden_id) then
    raise exception 'La orden de trabajo seleccionada no existe.';
  end if;

  select nombre
  into v_kit_nombre
  from public.herramienta_kits
  where id = p_kit_id
    and rol_destino = 'instalador'
    and activo = true;

  if v_kit_nombre is null then
    raise exception 'Selecciona un kit de instalación activo.';
  end if;

  perform id
  from public.herramientas
  where id = any(p_herramientas_ids)
  order by id
  for update;

  select count(*)
  into v_cantidad
  from public.herramientas
  where id = any(p_herramientas_ids);

  if v_cantidad <> cardinality(p_herramientas_ids) then
    raise exception 'Una o más herramientas ya no están disponibles.';
  end if;

  if exists (
    select 1
    from public.herramientas
    where id = any(p_herramientas_ids)
      and (
        colaborador_id is not null
        or estado in ('Mantenimiento', 'Perdida', 'Dañada')
      )
  ) then
    raise exception 'Una o más herramientas fueron asignadas o dejaron de estar disponibles. Actualiza la lista.';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', id,
      'nombre', nombre,
      'codigo', codigo,
      'categoria', categoria,
      'estado', estado
    )
    order by nombre
  )
  into v_herramientas
  from public.herramientas
  where id = any(p_herramientas_ids);

  insert into public.herramienta_instalaciones (
    id, orden_id, instalador_id, instalador_nombre, kit_id, kit_nombre,
    herramientas, checklist_salida, checklist_salida_nombre,
    observaciones_salida, creado_por, creado_por_nombre
  ) values (
    v_instalacion_id, p_orden_id, p_instalador_id, v_instalador_nombre, p_kit_id, v_kit_nombre,
    v_herramientas, p_checklist_salida, p_checklist_nombre,
    nullif(btrim(p_novedad), ''), auth.uid(), p_registrado_por_nombre
  );

  insert into public.herramienta_registros (
    id, colaborador_id, colaborador_nombre, orden_id, checklist_id,
    checklist_nombre, tipo, items, herramientas, novedad
  ) values (
    v_registro_id, p_instalador_id, v_instalador_nombre, p_orden_id, null,
    p_checklist_nombre, 'salida', p_checklist_salida, v_herramientas, nullif(btrim(p_novedad), '')
  );

  update public.herramientas
  set estado = 'En uso',
      colaborador_id = p_instalador_id,
      colaborador_nombre = v_instalador_nombre,
      asignado_por = auth.uid(),
      asignado_por_nombre = p_registrado_por_nombre,
      asignado_en = now(),
      actualizado_en = now()
  where id = any(p_herramientas_ids);

  insert into public.herramienta_movimientos (
    lote_id, herramienta_id, herramienta_nombre, herramienta_codigo,
    colaborador_id, colaborador_nombre, tipo, estado_anterior, estado_nuevo,
    orden_id, registro_id, novedad, registrado_por, registrado_por_nombre
  )
  select
    v_instalacion_id,
    (item->>'id')::uuid,
    item->>'nombre',
    item->>'codigo',
    p_instalador_id,
    v_instalador_nombre,
    'salida',
    item->>'estado',
    'En uso',
    p_orden_id,
    v_registro_id,
    nullif(btrim(p_novedad), ''),
    auth.uid(),
    p_registrado_por_nombre
  from jsonb_array_elements(v_herramientas) as items(item);

  return v_instalacion_id;
end
$$;

create or replace function public.finalizar_salida_instalacion(
  p_instalacion_id uuid,
  p_checklist_retorno jsonb,
  p_checklist_nombre text,
  p_novedad text,
  p_registrado_por_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salida public.herramienta_instalaciones%rowtype;
  v_registro_id uuid := gen_random_uuid();
  v_herramienta_ids uuid[];
  v_cantidad integer;
begin
  if not (public.es_admin() or public.es_jefe()) then
    raise exception 'Solo el administrador o jefe de taller puede cerrar salidas de instalación.';
  end if;

  if p_checklist_retorno is null or jsonb_typeof(p_checklist_retorno) is distinct from 'array' then
    raise exception 'Selecciona un chequeo de retorno válido.';
  end if;

  if jsonb_array_length(p_checklist_retorno) = 0 or exists (
    select 1
    from jsonb_array_elements(p_checklist_retorno) as items(item)
    where coalesce((item->>'marcado')::boolean, false) = false
  ) then
    raise exception 'Completa todos los puntos del chequeo de retorno antes de cerrar.';
  end if;

  select *
  into v_salida
  from public.herramienta_instalaciones
  where id = p_instalacion_id
  for update;

  if not found then
    raise exception 'No se encontró la salida de instalación.';
  end if;

  if v_salida.estado <> 'en_curso' then
    raise exception 'Esta instalación ya fue cerrada.';
  end if;

  select array_agg((item->>'id')::uuid)
  into v_herramienta_ids
  from jsonb_array_elements(v_salida.herramientas) as items(item);

  perform id
  from public.herramientas
  where id = any(v_herramienta_ids)
  order by id
  for update;

  select count(*)
  into v_cantidad
  from public.herramientas
  where id = any(v_herramienta_ids)
    and colaborador_id = v_salida.instalador_id;

  if v_cantidad <> cardinality(v_herramienta_ids) then
    raise exception 'No se pudo confirmar el retorno: revisa las herramientas asignadas al instalador.';
  end if;

  update public.herramientas
  set estado = 'Disponible',
      colaborador_id = null,
      colaborador_nombre = null,
      asignado_por = null,
      asignado_por_nombre = null,
      asignado_en = null,
      actualizado_en = now()
  where id = any(v_herramienta_ids);

  insert into public.herramienta_registros (
    id, colaborador_id, colaborador_nombre, orden_id, checklist_id,
    checklist_nombre, tipo, items, herramientas, novedad
  ) values (
    v_registro_id, v_salida.instalador_id, v_salida.instalador_nombre,
    v_salida.orden_id, null, p_checklist_nombre, 'entrada',
    p_checklist_retorno, v_salida.herramientas, nullif(btrim(p_novedad), '')
  );

  insert into public.herramienta_movimientos (
    lote_id, herramienta_id, herramienta_nombre, herramienta_codigo,
    colaborador_id, colaborador_nombre, tipo, estado_anterior, estado_nuevo,
    orden_id, registro_id, novedad, registrado_por, registrado_por_nombre
  )
  select
    v_salida.id,
    (item->>'id')::uuid,
    item->>'nombre',
    item->>'codigo',
    v_salida.instalador_id,
    v_salida.instalador_nombre,
    'entrada',
    'En uso',
    'Disponible',
    v_salida.orden_id,
    v_registro_id,
    nullif(btrim(p_novedad), ''),
    auth.uid(),
    p_registrado_por_nombre
  from jsonb_array_elements(v_salida.herramientas) as items(item);

  update public.herramienta_instalaciones
  set estado = 'finalizada',
      checklist_retorno = p_checklist_retorno,
      checklist_retorno_nombre = p_checklist_nombre,
      observaciones_retorno = nullif(btrim(p_novedad), ''),
      retorno_en = now()
  where id = v_salida.id;
end
$$;

revoke all on function public.iniciar_salida_instalacion(uuid, uuid, uuid, uuid[], jsonb, text, text, text) from public, anon;
revoke all on function public.finalizar_salida_instalacion(uuid, jsonb, text, text, text) from public, anon;
grant execute on function public.iniciar_salida_instalacion(uuid, uuid, uuid, uuid[], jsonb, text, text, text) to authenticated;
grant execute on function public.finalizar_salida_instalacion(uuid, jsonb, text, text, text) to authenticated;

notify pgrst, 'reload schema';
