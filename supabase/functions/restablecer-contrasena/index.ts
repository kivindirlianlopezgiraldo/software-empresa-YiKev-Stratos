import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respuesta(mensaje: string, estado: number) {
  return new Response(JSON.stringify({ error: mensaje }), {
    status: estado,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return respuesta('Método no permitido.', 405);
  }

  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return respuesta('Debes iniciar sesión para realizar esta acción.', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
    return respuesta('El servicio de restablecimiento no está configurado.', 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usuarioSesion, error: errorSesion } =
    await supabaseAdmin.auth.getUser(accessToken);
  if (errorSesion || !usuarioSesion.user) {
    return respuesta('La sesión no es válida o expiró. Inicia sesión nuevamente.', 401);
  }

  const { data: perfilAdmin, error: errorPerfilAdmin } = await supabaseAdmin
    .from('perfiles_usuario')
    .select('rol, activo')
    .eq('id', usuarioSesion.user.id)
    .maybeSingle();

  if (errorPerfilAdmin) {
    console.error('No se pudo validar el perfil del solicitante:', errorPerfilAdmin.message);
    return respuesta('No se pudo validar tu autorización.', 500);
  }

  if (
    perfilAdmin?.rol !== 'Super Admin' ||
    perfilAdmin.activo === false
  ) {
    return respuesta('Solo un Super Admin activo puede restablecer contraseñas.', 403);
  }

  let payload: { userId?: unknown; newPassword?: unknown };
  try {
    payload = await request.json();
  } catch {
    return respuesta('La solicitud no tiene un formato válido.', 400);
  }

  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : '';

  if (!userId) {
    return respuesta('Selecciona el colaborador al que se restablecerá la contraseña.', 400);
  }
  if (newPassword.length < 8) {
    return respuesta('La nueva contraseña debe tener al menos 8 caracteres.', 400);
  }

  const { data: perfilDestino, error: errorPerfilDestino } = await supabaseAdmin
    .from('perfiles_usuario')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (errorPerfilDestino) {
    console.error('No se pudo validar el perfil de destino:', errorPerfilDestino.message);
    return respuesta('No se pudo validar el colaborador seleccionado.', 500);
  }
  if (!perfilDestino) {
    return respuesta('El colaborador seleccionado no existe.', 404);
  }

  const { error: errorCambio } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (errorCambio) {
    console.error('Supabase Auth rechazó el restablecimiento:', errorCambio.message);
    return respuesta('No se pudo restablecer la contraseña. Verifica los requisitos de Auth.', 400);
  }

  console.info('Contraseña restablecida por Super Admin.', {
    solicitante: usuarioSesion.user.id,
    usuario: userId,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
