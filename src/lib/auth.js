import { supabase, crearClienteAislado } from './supabase';
import { DOMINIO_INTERNO } from './constants';

/**
 * El taller inicia sesión con el número de documento, pero Supabase Auth
 * exige un email. Se usa un email interno determinista a partir del documento,
 * de modo que el login no necesita consultar la base de datos antes de
 * autenticarse (y por tanto no depende de políticas RLS públicas).
 */
export function emailDesdeDocumento(documento) {
  const limpio = String(documento ?? '').replace(/[^\dA-Za-z]/g, '').trim();
  return `${limpio}@${DOMINIO_INTERNO}`;
}

export function documentoDesdeEmail(email) {
  return String(email ?? '').split('@')[0];
}

const MENSAJES = [
  [/invalid login credentials/i, 'Número de documento o contraseña incorrectos.'],
  [/email not confirmed/i, 'Tu correo interno aún no está confirmado. Contacta al administrador.'],
  [/user already registered|already been registered/i, 'Ya existe un colaborador con ese número de documento.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/auth session missing/i, 'La sesión expiró. Vuelve a iniciar sesión.'],
  [/rate limit|too many requests/i, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
  [/failed to fetch|networkerror/i, 'No hay conexión con el servidor. Revisa tu red.'],
];

export function traducirErrorAuth(error) {
  const mensaje = error?.message || String(error || '');
  const encontrado = MENSAJES.find(([patron]) => patron.test(mensaje));
  return encontrado ? encontrado[1] : mensaje || 'Ocurrió un error inesperado.';
}

/** Inicia sesión con documento (cédula) + contraseña. */
export async function iniciarSesion(documento, password) {
  const email = emailDesdeDocumento(documento);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(traducirErrorAuth(error));
  return data;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

/**
 * Crea el usuario en Supabase Auth sin tocar la sesión del administrador.
 * Se usa un cliente aislado (sin persistencia) porque `signUp` inicia sesión
 * automáticamente cuando la confirmación por email está desactivada.
 */
export async function crearUsuarioAuth(documento, password) {
  const email = emailDesdeDocumento(documento);
  const cliente = crearClienteAislado();

  const { data, error } = await cliente.auth.signUp({ email, password });

  // No hace falta cerrar sesión: el cliente es aislado y no persiste nada.
  if (error) throw new Error(traducirErrorAuth(error));
  if (!data?.user?.id) {
    throw new Error('Supabase no devolvió el identificador del usuario creado.');
  }
  return data.user;
}
