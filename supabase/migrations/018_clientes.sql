create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  direccion text,
  barrio text,
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists clientes_nombre_idx on public.clientes (nombre);
create index if not exists clientes_telefono_idx on public.clientes (telefono);

alter table public.clientes enable row level security;
revoke all on public.clientes from anon;
grant select, insert, update, delete on public.clientes to authenticated;

drop policy if exists "clientes_select" on public.clientes;
create policy "clientes_select"
  on public.clientes for select to authenticated
  using (true);

drop policy if exists "clientes_insert" on public.clientes;
create policy "clientes_insert"
  on public.clientes for insert to authenticated
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "clientes_update" on public.clientes;
create policy "clientes_update"
  on public.clientes for update to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "clientes_delete" on public.clientes;
create policy "clientes_delete"
  on public.clientes for delete to authenticated
  using (public.es_admin() or public.es_jefe());

notify pgrst, 'reload schema';
