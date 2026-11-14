-- Extensiones temporales de acceso fuera de la jornada laboral.
-- Solo admin/jefe puede concederlas; cada empleado solo consulta su propia
-- extensión activa. Ejecutar después de la migración 001.

do $$
begin
  if to_regprocedure('public.es_admin()') is null
     or to_regprocedure('public.es_jefe()') is null then
    raise exception 'Falta la migración 001: no existen las funciones de permisos de admin y jefe.';
  end if;
end
$$;

create table if not exists public.herramienta_accesos_extendidos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles_usuario (id) on delete cascade,
  vence_en timestamptz not null,
  motivo text,
  concedido_por uuid references public.perfiles_usuario (id) on delete set null,
  concedido_por_nombre text,
  concedido_en timestamptz not null default now(),
  constraint herramienta_accesos_extendidos_vigencia_check
    check (vence_en > concedido_en)
);

create index if not exists herramienta_accesos_extendidos_usuario_vigencia_idx
  on public.herramienta_accesos_extendidos (usuario_id, vence_en desc);

alter table public.herramienta_accesos_extendidos enable row level security;
revoke all on public.herramienta_accesos_extendidos from anon, authenticated;
grant select, insert on public.herramienta_accesos_extendidos to authenticated;

drop policy if exists "herramienta_accesos_extendidos_select" on public.herramienta_accesos_extendidos;
create policy "herramienta_accesos_extendidos_select"
  on public.herramienta_accesos_extendidos
  for select to authenticated
  using (
    public.es_admin()
    or public.es_jefe()
    or (usuario_id = auth.uid() and vence_en > now())
  );

drop policy if exists "herramienta_accesos_extendidos_insert" on public.herramienta_accesos_extendidos;
create policy "herramienta_accesos_extendidos_insert"
  on public.herramienta_accesos_extendidos
  for insert to authenticated
  with check (
    (public.es_admin() or public.es_jefe())
    and concedido_por = auth.uid()
    and vence_en > now()
  );

notify pgrst, 'reload schema';
