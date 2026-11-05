-- ============================================================
-- YiKev Stratos — Crear o reparar un usuario de acceso
-- Ejecutar en el SQL Editor del proyecto de Supabase.
--
-- Login en la app:  <documento>@yikevstratos.local
-- Edita las 4 variables de abajo antes de ejecutar.
-- ============================================================
set search_path = public, extensions;

do $$
declare
  v_documento text := '0000000000';        -- documento (solo números)
  v_password  text := 'ClaveTemporal123';  -- mínimo 6 caracteres
  v_nombre    text := 'Administrador';     -- se usa solo si hay que crear el perfil
  v_rol       text := 'Super Admin';

  v_email      text := v_documento || '@yikevstratos.local';
  v_user_id    uuid;
  v_profile_id uuid;
  v_auth_email uuid;
begin
  if length(trim(v_documento)) = 0 then
    raise exception 'Debes indicar el documento.';
  end if;
  if length(v_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;

  -- 1) Perfil existente con ese documento
  select id into v_profile_id
  from public.perfiles_usuario
  where documento_id = v_documento
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
           encrypted_password = crypt(v_password, gen_salt('bf')),
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
      v_email, crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      '', '', '', ''
    );
  end if;

  -- 5) Identidad de email (necesaria para el login)
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

  -- 6) Perfil (se inserta después de Auth por la clave foránea)
  if v_profile_id is null then
    insert into public.perfiles_usuario
      (id, nombre_completo, documento_id, rol, activo, creado_en)
    values
      (v_user_id, v_nombre, v_documento, v_rol, true, now());
  else
    if v_profile_id <> v_user_id then
      update public.perfiles_usuario
         set id = v_user_id
       where id = v_profile_id;
    end if;

    update public.perfiles_usuario
       set rol = v_rol,
           activo = true,
           nombre_completo = coalesce(nullif(nombre_completo, ''), v_nombre)
     where id = v_user_id;
  end if;

  raise notice 'Usuario listo: % (id %)', v_email, v_user_id;
end
$$;

-- Verificación (cambia el documento)
-- select u.id, u.email, u.email_confirmed_at is not null as confirmado,
--        p.id is not null as tiene_perfil, p.rol
-- from auth.users u
-- left join public.perfiles_usuario p on p.id = u.id
-- where u.email = '0000000000@yikevstratos.local';
