// ============================================================================
// Notificaciones internas
// ----------------------------------------------------------------------------
// Una notificación puede apuntar a una persona (`usuario_id`) o a un grupo de
// trabajo (`rol_destino`: admin, jefe, produccion, instalador, bodega). RLS
// filtra automáticamente lo que cada usuario puede ver.
// ============================================================================

import { supabase } from './supabase';

export const TIPOS_NOTIFICACION = {
  INFO: 'info',
  ORDEN: 'orden',
  MEDIDA: 'medida',
  PRODUCCION: 'produccion',
  HERRAMIENTA: 'herramienta',
  SISTEMA: 'sistema',
};

export async function crearNotificacion({
  usuarioId = null,
  rolDestino = null,
  ordenId = null,
  tipo = TIPOS_NOTIFICACION.INFO,
  titulo,
  mensaje = '',
}) {
  if (!titulo) return null;

  const { data, error } = await supabase
    .from('notificaciones')
    .insert([
      {
        usuario_id: usuarioId,
        rol_destino: rolDestino,
        orden_id: ordenId,
        tipo,
        titulo,
        mensaje,
      },
    ])
    .select('*')
    .maybeSingle();

  if (error) {
    console.warn('No se pudo crear la notificación:', error.message);
    return null;
  }
  return data;
}

/**
 * Notifica a uno o varios grupos. Ignora silenciosamente los errores: una
 * notificación no debe bloquear el flujo real de una orden.
 */
export async function notificarRoles(roles = [], payload = {}) {
  const destinos = [...new Set(roles.filter(Boolean))];
  if (!destinos.length) return [];
  return Promise.all(destinos.map((rol) => crearNotificacion({ ...payload, rolDestino: rol })));
}

export async function cargarNotificaciones(limite = 40) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .order('creado_en', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data ?? [];
}

export async function marcarNotificacionLeida(id) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', id)
    .eq('leida', false);
  if (error) throw error;
}

export async function marcarTodasLeidas(ids = []) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .in('id', ids)
    .eq('leida', false);
  if (error) throw error;
}
