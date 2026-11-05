-- ============================================================
-- YiKev Stratos — Crear los usuarios del equipo
-- Ejecutar completo en el SQL Editor del proyecto de Supabase.
--
-- Login: <documento>@yikevstratos.local
-- Es idempotente: si ya existen, les actualiza la clave y el rol.
--
-- Usuarios:
--   1000000001  Juan Pérez     Producción       Prod2026*
--   1000000002  Carlos Rivas   Jefe de Taller   Jefe2026*
-- ============================================================
set search_path = public, extensions;

do $$
declare
  r record;
  v_email      text;
  v_user_id    uuid;
  v_profile_id uuid;
  v_auth_email uuid;
begin
  for r in
    select *
    from (values
      ('1000000001', 'Juan Pérez',   'Producción',     'Prod2026*'),
      ('1000000002', 'Carlos Rivas', 'Jefe de Taller', 'Jefe2026*')
    ) as t(documento, nombre, rol, clave)
  loop
    if length(trim(r.documento)) = 0 then
      raise exception 'Hay un documento vacío en la lista de usuarios.';
    end if;
    if length(r.clave) < 6 then
      raise exception 'La contraseña de % es demasiado corta.', r.documento;
    end if;

    v_email := r.documento || '@yikevstratos.local';

    -- 1) Perfil existente con ese documento
    select id into v_profile_id
    from public.perfiles_usuario
    where documento_id = r.documento
    limit 1;

    -- 2) Cuenta Auth existente con el email interno
    select id into v_auth_email
    from auth.users
    where email = v_email
    limit 1;

    -- 3) Elegir el id definitivo
    if v_auth_email is not null then
      v_user_id := v_auth_email;
    elsif v_profile_id is not null then
      v_user_id := v_profile_id;
    else
      v_user_id := gen_random_uuid();
    end if;

    -- 4) Crear o actualizar la cuenta Auth
    if exists (select 1 from auth.users where id = v_user_id) then
      update auth.users
         set email = v_email,
             encrypted_password = crypt(r.clave, gen_salt('bf')),
             email_confirmed_at = coalesce(email_confirmed_at, now()),
             updated_at = now()
       where id = v_user_id;
    else
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id, 'authenticated', 'authenticated',
        v_email, crypt(r.clave, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        '', '', '', ''
      );
    end if;

    -- 5) Identidad de email (obligatoria para poder iniciar sesión)
    if exists (
      select 1 from auth.identities
      where user_id = v_user_id and provider = 'email'
    ) then
      update auth.identities
         set provider_id = v_email,
             identity_data = jsonb_build_object(
               'sub', v_user_id::text,
               'email', v_email,
               'email_verified', true,
               'phone_verified', false
             ),
             updated_at = now()
       where user_id = v_user_id and provider = 'email';
    else
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        v_user_id,
        v_email,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email', now(), now(), now()
      );
    end if;

    -- 6) Perfil (después de Auth por la clave foránea)
    if v_profile_id is null then
      insert into public.perfiles_usuario
        (id, nombre_completo, documento_id, rol, activo, creado_en)
      values
        (v_user_id, r.nombre, r.documento, r.rol, true, now());
    else
      if v_profile_id <> v_user_id then
        update public.perfiles_usuario
           set id = v_user_id
         where id = v_profile_id;
      end if;

      update public.perfiles_usuario
         set rol = r.rol,
             activo = true,
             nombre_completo = coalesce(nullif(nombre_completo, ''), r.nombre)
       where id = v_user_id;
    end if;

    raise notice 'Listo: % | % | %', r.documento, r.nombre, r.rol;
  end loop;
end
$$;

-- Verificación
select p.documento_id, p.nombre_completo, p.rol, p.activo, u.email
from public.perfiles_usuario p
left join auth.users u on u.id = p.id
order by p.rol;
