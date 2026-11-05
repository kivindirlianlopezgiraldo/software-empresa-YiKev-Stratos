// ============================================================================
// Asistente virtual YiKev Stratos
// ----------------------------------------------------------------------------
// Envía la conversación a la Edge Function `chat` de Supabase. Si la función
// no está desplegada o no tiene una clave de IA configurada, devuelve una
// respuesta local útil para que el chat nunca quede en blanco.
// ============================================================================

import { supabase } from './supabase';

export const MENSAJE_BIENVENIDA_LANDING =
  '¡Hola! Soy el asistente de YiKev Stratos. Puedo ayudarte con servicios, materiales, tiempos y cómo pedir tu cotización. ¿Qué proyecto tienes en mente?';

export const MENSAJE_BIENVENIDA_EMPLEADO =
  '¡Hola! Soy tu asistente de taller. Puedo ayudarte con órdenes, medidas, despiece, inventario, herramientas y el flujo de producción. ¿Qué necesitas?';

export const SUGERENCIAS_LANDING = [
  '¿Qué servicios ofrecen?',
  '¿Cómo pido una cotización?',
  '¿Trabajan vidrio templado?',
  '¿Atienden mi zona?',
];

export const SUGERENCIAS_EMPLEADO = [
  '¿Cómo envío una orden a producción?',
  '¿Cómo registro las medidas de vidrio?',
  '¿Qué hago si falta un insumo?',
  '¿Cómo firmo el checklist de herramientas?',
];

const normalizar = (texto) =>
  String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Respuesta local de emergencia. No reemplaza a la IA: mantiene el chat
 * operativo cuando la Edge Function no está disponible.
 */
export function respuestaLocal(texto, modo = 'landing', contexto = {}) {
  const t = normalizar(texto);
  const incluye = (...palabras) => palabras.some((palabra) => t.includes(normalizar(palabra)));

  if (modo === 'empleado') {
    if (incluye('orden', 'produccion', 'taller', 'despiece')) {
      return (
        'Para mover una orden al taller: abre “Órdenes y Medidas”, revisa que tenga dirección y ' +
        'proyectos con ancho y alto, y usa “Enviar a Producción” o “Aprobar y Enviar a Taller”. ' +
        'El sistema calcula el despiece con la receta del sistema elegido y avisa al equipo de producción.'
      );
    }
    if (incluye('vidrio', 'medida')) {
      return (
        'En una orden que ya está “En Producción”, pulsa “Medidas de Vidrio”. Confirma ancho, alto, ' +
        'cantidad y espesor de cada pieza; al enviar, el jefe de taller recibe la notificación.'
      );
    }
    if (incluye('inventario', 'insumo', 'falta', 'stock')) {
      return (
        'Revisa “Inventario de Producción”: allí puedes sumar o descontar unidades, editar el insumo ' +
        'y asignar un responsable. Si el stock está por debajo del mínimo, avisa al jefe para reponerlo.'
      );
    }
    if (incluye('herramienta', 'checklist', 'salida', 'entrada')) {
      return (
        'Entra a “Herramientas y Checklists”, abre la pestaña Checklists y firma la plantilla de ' +
        'salida o entrada. Marca cada punto verificado y escribe cualquier novedad antes de guardar.'
      );
    }
    if (incluye('receta', 'sistema', 'corte', 'perfil')) {
      return (
        'Las recetas se administran en “Sistemas y Recetas”. Cada línea define tipo de pieza, fórmula ' +
        'de corte, descuento en milímetros y merma. Usa “Ver muestra 120×100” para validar el despiece.'
      );
    }
    return (
      'Puedo ayudarte con órdenes, medidas de vidrio, despiece, inventario de producción y ' +
      'herramientas. Dime qué módulo estás usando y te indico los pasos.'
    );
  }

  // Landing pública
  if (incluye('servicio', 'hacen', 'ofrecen', 'trabajan')) {
    return (
      'Trabajamos aluminio arquitectónico, vidrio templado y laminado, PVC y acrílico. ' +
      'Hacemos ventanas, puertas, fachadas, divisiones de baño, barandas, espejos y cerramientos a medida.'
    );
  }
  if (incluye('cotiz', 'precio', 'cuesta', 'valor')) {
    return (
      'La cotización depende de las medidas, el sistema, el tipo de vidrio y los accesorios. ' +
      'Escríbenos por el formulario de contacto o WhatsApp con medidas aproximadas y te damos los siguientes pasos.'
    );
  }
  if (incluye('vidrio', 'templado', 'acrilico', 'pvc')) {
    return (
      'Sí. Usamos vidrio claro, bronce, gris, laminado y templado, además de PVC y acrílico. ' +
      'Para baños y barandas recomendamos templado de 8 a 10 mm según el diseño.'
    );
  }
  if (incluye('zona', 'ciudad', 'atienden', 'quibdo', 'choco', 'ubicacion')) {
    return (
      `Estamos en ${contexto.ciudad || 'Quibdó'}, ${contexto.departamento || 'Chocó'}. ` +
      'Atendemos la ciudad y municipios cercanos; cuéntanos la ubicación exacta para confirmar la visita.'
    );
  }
  if (incluye('tiempo', 'demora', 'cuanto tarda', 'entrega')) {
    return (
      'Un trabajo típico toma entre 5 y 15 días hábiles después de aprobada la cotización, ' +
      'según el tamaño, los materiales y la disponibilidad de vidrio templado.'
    );
  }
  return (
    'Con gusto te ayudamos. Cuéntame si buscas ventanas, puertas, divisiones de baño, fachadas o ' +
    'espejos, y tu ciudad. También puedes usar el formulario de contacto para enviar las medidas.'
  );
}

/**
 * Envía la conversación al backend. `mensajes` debe ser
 * [{ rol: 'user' | 'assistant', contenido: string }].
 */
export async function enviarMensajeChat({ mensajes, modo = 'landing', contexto = {} }) {
  const ultimo = [...mensajes].reverse().find((mensaje) => mensaje.rol === 'user');
  const texto = ultimo?.contenido || '';

  try {
    const { data, error } = await supabase.functions.invoke('chat', {
      body: {
        modo,
        contexto,
        mensajes: mensajes.map((mensaje) => ({
          role: mensaje.rol === 'assistant' ? 'assistant' : 'user',
          content: mensaje.contenido,
        })),
      },
    });

    if (error) throw error;

    const respuesta = typeof data === 'string' ? data : data?.respuesta || data?.message;
    if (respuesta && String(respuesta).trim()) {
      return { texto: String(respuesta).trim(), origen: 'ia' };
    }
    throw new Error('La respuesta del asistente llegó vacía.');
  } catch (err) {
    console.warn('Chat IA no disponible, usando respuesta local:', err?.message || err);
    return { texto: respuestaLocal(texto, modo, contexto), origen: 'local' };
  }
}
