// ============================================================================
// Fotos de referencia de las órdenes de trabajo
// ----------------------------------------------------------------------------
// Las imágenes viven en el bucket privado "referencias" y se muestran con
// URLs firmadas de corta duración. Nunca se exponen como enlaces públicos.
// ============================================================================

import { supabase } from './supabase';
import { nuevoId } from './format';

export const BUCKET_REFERENCIAS = 'referencias';
export const MAX_IMAGENES = 3;
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024; // 5 MB
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const SEGUNDOS_URL_FIRMADA = 60 * 60; // 1 hora

/**
 * Valida una imagen antes de subirla.
 * Devuelve un mensaje de error en español, o null si es válida.
 */
export function validarImagen(archivo) {
  if (!archivo) return 'No se seleccionó ninguna imagen.';

  if (!TIPOS_IMAGEN.includes(archivo.type)) {
    return `“${archivo.name}” no es una imagen válida. Usa JPG, PNG o WEBP.`;
  }

  if (archivo.size > MAX_BYTES_IMAGEN) {
    return `“${archivo.name}” pesa más de 5 MB. Comprímela e intenta de nuevo.`;
  }

  return null;
}

/** Nombre de archivo seguro: sin tildes, espacios ni caracteres raros. */
function nombreSeguro(archivo) {
  const base = String(archivo.name || 'referencia')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-80);
  return base || 'referencia.jpg';
}

/**
 * Sube una imagen al bucket privado y devuelve su ruta interna.
 * La ruta queda organizada por orden: "{ordenId}/{uuid}-{archivo}".
 */
export async function subirImagenReferencia(archivo, ordenId) {
  const errorValidacion = validarImagen(archivo);
  if (errorValidacion) throw new Error(errorValidacion);

  const ruta = `${ordenId}/${nuevoId()}-${nombreSeguro(archivo)}`;

  const { error } = await supabase.storage
    .from(BUCKET_REFERENCIAS)
    .upload(ruta, archivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: archivo.type,
    });

  if (error) {
    throw new Error(
      `No se pudo subir “${archivo.name}”: ${error.message}. ` +
        'Verifica que la migración 002 esté aplicada en Supabase.',
    );
  }

  return ruta;
}

/** URL firmada temporal para ver una imagen del bucket privado. */
export async function urlFirmada(ruta, segundos = SEGUNDOS_URL_FIRMADA) {
  if (!ruta) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_REFERENCIAS)
    .createSignedUrl(ruta, segundos);

  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Firma varias rutas en paralelo; descarta las que fallen. */
export async function urlsFirmadas(rutas = [], segundos = SEGUNDOS_URL_FIRMADA) {
  const resultados = await Promise.all(
    rutas.map(async (ruta) => ({ ruta, url: await urlFirmada(ruta, segundos) })),
  );
  return resultados.filter((item) => item.url);
}

/** Borra imágenes del bucket (mejor esfuerzo: no bloquea el flujo). */
export async function eliminarImagenesReferencia(rutas = []) {
  const limpias = rutas.filter(Boolean);
  if (!limpias.length) return;

  const { error } = await supabase.storage.from(BUCKET_REFERENCIAS).remove(limpias);
  if (error) console.warn('No se pudieron borrar algunas referencias:', error.message);
}

/** Enlace de Google Maps a partir de dirección + barrio + ciudad. */
export function enlaceMapa(direccion, barrio, ciudad = 'Quibdó') {
  const partes = [direccion, barrio].filter(Boolean);
  // Sin dirección ni barrio no hay ruta que mostrar (no basta con la ciudad).
  if (!partes.length) return null;
  if (ciudad) partes.push(ciudad);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(partes.join(', '))}`;
}

/** Enlace telefónico limpio para el protocolo tel:. */
export function enlaceTelefono(telefono) {
  const limpio = String(telefono || '').replace(/[^\d+]/g, '');
  return limpio ? `tel:${limpio}` : null;
}
