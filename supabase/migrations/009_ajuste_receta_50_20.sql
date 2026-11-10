-- ============================================================================
-- YiKev Stratos ERP — Migración 009
-- Actualiza la receta del Sistema 50/20 con dos horizontales y el lado
-- correcto del corte angular de las jambas.
-- ============================================================================
--
-- Ejecutar después de la migración 008. Es idempotente y conserva los
-- materiales/precios existentes.

update public.sistemas_trabajo
set descripcion =
  'Ventana corrediza 50/20. Marco: 2 jambas, 1 sillar y 1 cabezal. Nave: 2 topes, 2 enganches y 2 horizontales. Accesorios: 1 seguro y 4 rodachinas. Jamba alto −1.3 cm con corte a 5° en el lado del sillar; sillar y cabezal al ancho total; tope y enganche alto −3 cm; cada horizontal (ancho −2.8 cm) ÷ 2.'
where lower(nombre) = lower('Sistema 50/20');

update public.sistema_materiales as sm
set cantidad_requerida = receta.cantidad,
    tipo_pieza = receta.tipo,
    formula_largo = receta.base,
    formula_config = jsonb_build_object(
      'base', receta.base,
      'restarCm', receta.restar_cm,
      'dividir', receta.dividir,
      'referencia', '',
      'angulo', receta.angulo,
      'ladoAngulo', receta.lado_angulo
    ),
    angulo_corte = receta.angulo
from (
  values
    ('Sillar 50/20',     'perfil',    'ancho', 0::numeric,   1::numeric, 1::numeric, 0::numeric, ''),
    ('Cabezal 50/20',    'perfil',    'ancho', 0::numeric,   1::numeric, 1::numeric, 0::numeric, ''),
    ('Jamba 50/20',      'perfil',    'alto',  1.3::numeric, 1::numeric, 2::numeric, 5::numeric, 'sillar'),
    ('Tope 50/20',       'perfil',    'alto',  3::numeric,   1::numeric, 2::numeric, 0::numeric, ''),
    ('Enganche 50/20',   'perfil',    'alto',  3::numeric,   1::numeric, 2::numeric, 0::numeric, ''),
    ('Horizontal 50/20', 'perfil',    'ancho', 2.8::numeric, 2::numeric, 2::numeric, 0::numeric, ''),
    ('Seguro 50/20',     'accesorio', 'fijo',  0::numeric,   1::numeric, 1::numeric, 0::numeric, ''),
    ('Rodachina 50/20',  'accesorio', 'fijo',  0::numeric,   1::numeric, 4::numeric, 0::numeric, '')
) as receta(nombre, tipo, base, restar_cm, dividir, cantidad, angulo, lado_angulo)
join public.inventario_materiales as material
  on lower(material.nombre) = lower(receta.nombre)
where sm.sistema_id in (
    select id
    from public.sistemas_trabajo
    where lower(nombre) = lower('Sistema 50/20')
  )
  and sm.material_id = material.id;
