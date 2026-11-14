-- Limita la consulta de herramientas al empleado asignado y a los responsables.
-- Ejecutar después de las migraciones 001 y 005 en el SQL Editor de Supabase.

do $$
begin
  if to_regclass('public.herramientas') is null then
    raise exception 'Falta la migración 005: no existe public.herramientas.';
  end if;

  if to_regprocedure('public.es_admin()') is null
     or to_regprocedure('public.es_jefe()') is null then
    raise exception 'Falta la migración 001: no existen las funciones de permisos de admin y jefe.';
  end if;
end $$;

drop policy if exists "herramientas_select" on public.herramientas;
create policy "herramientas_select" on public.herramientas
  for select to authenticated
  using (
    public.es_admin()
    or public.es_jefe()
    or colaborador_id = auth.uid()
  );
