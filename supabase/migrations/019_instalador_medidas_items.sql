-- Permite al instalador registrar proyectos medidos solo en su propia orden asignada.

drop policy if exists "orden_items_write" on public.orden_items;

drop policy if exists "orden_items_insert_admin_jefe" on public.orden_items;
create policy "orden_items_insert_admin_jefe"
  on public.orden_items for insert to authenticated
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "orden_items_update_admin_jefe" on public.orden_items;
create policy "orden_items_update_admin_jefe"
  on public.orden_items for update to authenticated
  using (public.es_admin() or public.es_jefe())
  with check (public.es_admin() or public.es_jefe());

drop policy if exists "orden_items_delete_admin_jefe" on public.orden_items;
create policy "orden_items_delete_admin_jefe"
  on public.orden_items for delete to authenticated
  using (public.es_admin() or public.es_jefe());

drop policy if exists "orden_items_insert_instalador" on public.orden_items;
create policy "orden_items_insert_instalador"
  on public.orden_items for insert to authenticated
  with check (
    public.es_instalador()
    and exists (
      select 1
      from public.ordenes_trabajo orden
      where orden.id = orden_items.orden_id
        and orden.instalador_id = auth.uid()
    )
  );

drop policy if exists "orden_items_update_instalador" on public.orden_items;
create policy "orden_items_update_instalador"
  on public.orden_items for update to authenticated
  using (
    public.es_instalador()
    and exists (
      select 1
      from public.ordenes_trabajo orden
      where orden.id = orden_items.orden_id
        and orden.instalador_id = auth.uid()
    )
  )
  with check (
    public.es_instalador()
    and exists (
      select 1
      from public.ordenes_trabajo orden
      where orden.id = orden_items.orden_id
        and orden.instalador_id = auth.uid()
    )
  );

drop policy if exists "orden_items_delete_instalador" on public.orden_items;
create policy "orden_items_delete_instalador"
  on public.orden_items for delete to authenticated
  using (
    public.es_instalador()
    and exists (
      select 1
      from public.ordenes_trabajo orden
      where orden.id = orden_items.orden_id
        and orden.instalador_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
