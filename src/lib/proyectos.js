// ============================================================================
// Portafolio de proyectos y fotos públicas
// ----------------------------------------------------------------------------
// Las fotos de marketing viven en el bucket público "proyectos". En la base de
// datos se guardan rutas internas (o rutas locales de demostración) y aquí se
// convierten en URLs listas para mostrar en la landing.
// ============================================================================

import { supabase } from './supabase';
import { nuevoId } from './format';

export const BUCKET_PROYECTOS = 'proyectos';
export const MAX_IMAGENES_PROYECTO = 6;
export const MAX_BYTES_IMAGEN_PROYECTO = 5 * 1024 * 1024; // 5 MB
export const TIPOS_IMAGEN_PROYECTO = ['image/jpeg', 'image/png', 'image/webp'];

const URL_SUPABASE = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

/**
 * Convierte una ruta guardada en la base de datos a una URL visible.
 * Acepta URLs completas y rutas locales de los SVG de demostración.
 */
export function urlImagenProyecto(ruta) {
  const limpia = String(ruta ?? '').trim();
  if (!limpia) return null;

  if (/^(https?:|data:|blob:)/i.test(limpia) || limpia.startsWith('/')) return limpia;

  const camino = limpia
    .split('/')
    .filter(Boolean)
    .map((segmento) => encodeURIComponent(segmento))
    .join('/');

  return `${URL_SUPABASE}/storage/v1/object/public/${BUCKET_PROYECTOS}/${camino}`;
}

/** Normaliza el arreglo JSON de imágenes que llega desde PostgREST. */
export function normalizarImagenesProyecto(valor) {
  let lista = valor;

  if (typeof lista === 'string') {
    try {
      lista = JSON.parse(lista);
    } catch {
      lista = [];
    }
  }

  if (!Array.isArray(lista)) return [];

  return lista
    .map((ruta) => (typeof ruta === 'string' ? ruta.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_IMAGENES_PROYECTO);
}

/** Devuelve true si la ruta pertenece al bucket (no es una demo local). */
function esRutaDelBucket(ruta) {
  return Boolean(ruta) && !/^(https?:|data:|blob:)/i.test(ruta) && !ruta.startsWith('/');
}

/**
 * Valida una imagen antes de subirla.
 * Devuelve un mensaje de error en español, o null si es válida.
 */
export function validarImagenProyecto(archivo) {
  if (!archivo) return 'No se seleccionó ninguna imagen.';

  if (!TIPOS_IMAGEN_PROYECTO.includes(archivo.type)) {
    return `“${archivo.name}” no es una imagen válida. Usa JPG, PNG o WEBP.`;
  }

  if (archivo.size > MAX_BYTES_IMAGEN_PROYECTO) {
    return `“${archivo.name}” pesa más de 5 MB. Cómprimela e intenta de nuevo.`;
  }

  return null;
}

/** Nombre de archivo seguro: sin tildes, espacios ni caracteres raros. */
function nombreSeguro(archivo) {
  const base = String(archivo.name || 'proyecto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
  return base || 'proyecto.jpg';
}

/**
 * Sube una imagen al bucket público y devuelve su ruta interna.
 * La ruta queda organizada por proyecto: "{proyectoId}/{uuid}-{archivo}".
 */
export async function subirImagenProyecto(archivo, proyectoId) {
  const errorValidacion = validarImagenProyecto(archivo);
  if (errorValidacion) throw new Error(errorValidacion);
  if (!proyectoId) throw new Error('Falta el identificador del proyecto.');

  const ruta = `${proyectoId}/${nuevoId()}-${nombreSeguro(archivo)}`;

  const { error } = await supabase.storage.from(BUCKET_PROYECTOS).upload(ruta, archivo, {
    cacheControl: '3600',
    upsert: false,
    contentType: archivo.type,
  });

  if (error) {
    throw new Error(
      `No se pudo subir “${archivo.name}”: ${error.message}. ` +
        'Verifica que la migración 004 esté aplicada en Supabase.',
    );
  }

  return ruta;
}

/**
 * Borra imágenes del bucket (mejor esfuerzo: no bloquea el flujo).
 * Ignora las rutas locales de demostración.
 */
export async function eliminarImagenesProyecto(rutas = []) {
  const limpias = rutas.filter(esRutaDelBucket);
  if (!limpias.length) return;

  const { error } = await supabase.storage.from(BUCKET_PROYECTOS).remove(limpias);
  if (error) console.warn('No se pudieron borrar algunas fotos del proyecto:', error.message);
}
