-- Repara textos de checklists y kits que se guardaron con UTF-8 interpretado
-- como Windows-1252/Latin-1. Solo sustituye secuencias reconocidas.

do $$
begin
  if to_regclass('public.herramienta_checklists') is null
     or to_regclass('public.herramienta_kits') is null then
    raise exception 'Faltan las migraciones 005 y 007 para reparar checklists y kits.';
  end if;
end
$$;

create or replace function pg_temp.corregir_mojibake(texto text)
returns text
language plpgsql
immutable
as $$
declare
  resultado text := texto;
begin
  if texto is null then
    return null;
  end if;

  resultado := replace(resultado, chr(195) || chr(161), chr(225));
  resultado := replace(resultado, chr(195) || chr(169), chr(233));
  resultado := replace(resultado, chr(195) || chr(173), chr(237));
  resultado := replace(resultado, chr(195) || chr(179), chr(243));
  resultado := replace(resultado, chr(195) || chr(186), chr(250));
  resultado := replace(resultado, chr(195) || chr(177), chr(241));
  resultado := replace(resultado, chr(195) || chr(188), chr(252));
  resultado := replace(resultado, chr(195) || chr(129), chr(193));
  resultado := replace(resultado, chr(195) || chr(137), chr(201));
  resultado := replace(resultado, chr(195) || chr(141), chr(205));
  resultado := replace(resultado, chr(195) || chr(147), chr(211));
  resultado := replace(resultado, chr(195) || chr(154), chr(218));
  resultado := replace(resultado, chr(195) || chr(145), chr(209));
  resultado := replace(resultado, chr(195) || '‰', chr(201));
  resultado := replace(resultado, chr(195) || '“', chr(211));
  resultado := replace(resultado, chr(195) || 'Š', chr(218));
  resultado := replace(resultado, chr(195) || '‘', chr(209));
  resultado := replace(resultado, chr(194) || chr(161), chr(161));
  resultado := replace(resultado, chr(194) || chr(191), chr(191));

  return resultado;
end
$$;

update public.herramienta_checklists as checklist
set nombre = pg_temp.corregir_mojibake(checklist.nombre),
    items = (
      select coalesce(
        jsonb_agg(
          case
            when jsonb_typeof(item.valor) = 'string'
              then to_jsonb(pg_temp.corregir_mojibake(item.valor #>> '{}'))
            else item.valor
          end
          order by item.posicion
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(checklist.items) with ordinality as item(valor, posicion)
    )
where checklist.nombre is distinct from pg_temp.corregir_mojibake(checklist.nombre)
   or exists (
     select 1
     from jsonb_array_elements(checklist.items) as item(valor)
     where jsonb_typeof(item.valor) = 'string'
       and (item.valor #>> '{}') is distinct from pg_temp.corregir_mojibake(item.valor #>> '{}')
   );

update public.herramienta_kits as kit
set nombre = pg_temp.corregir_mojibake(kit.nombre),
    descripcion = pg_temp.corregir_mojibake(kit.descripcion),
    items = (
      select coalesce(
        jsonb_agg(
          case
            when jsonb_typeof(item.valor) = 'object'
              and jsonb_typeof(item.valor->'nombre') = 'string'
              then jsonb_set(
                item.valor,
                '{nombre}',
                to_jsonb(pg_temp.corregir_mojibake(item.valor->>'nombre'))
              )
            when jsonb_typeof(item.valor) = 'string'
              then to_jsonb(pg_temp.corregir_mojibake(item.valor #>> '{}'))
            else item.valor
          end
          order by item.posicion
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(kit.items) with ordinality as item(valor, posicion)
    )
where kit.nombre is distinct from pg_temp.corregir_mojibake(kit.nombre)
   or kit.descripcion is distinct from pg_temp.corregir_mojibake(kit.descripcion)
   or exists (
     select 1
     from jsonb_array_elements(kit.items) as item(valor)
     where (
       jsonb_typeof(item.valor) = 'object'
       and jsonb_typeof(item.valor->'nombre') = 'string'
       and (item.valor->>'nombre') is distinct from pg_temp.corregir_mojibake(item.valor->>'nombre')
     ) or (
       jsonb_typeof(item.valor) = 'string'
       and (item.valor #>> '{}') is distinct from pg_temp.corregir_mojibake(item.valor #>> '{}')
     )
   );

drop function pg_temp.corregir_mojibake(text);
