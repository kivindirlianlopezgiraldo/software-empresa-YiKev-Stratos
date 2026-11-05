// ============================================================================
// YiKev Stratos — Edge Function `chat`
// ----------------------------------------------------------------------------
// Despliegue:
//   supabase functions deploy chat --no-verify-jwt
//
// Variables de entorno (Supabase > Edge Functions > Secrets):
//   AI_API_KEY   obligatoria para respuestas con IA
//   AI_BASE_URL  opcional, por defecto https://api.openai.com/v1
//   AI_MODEL     opcional, por defecto gpt-4o-mini
//
// Si no hay AI_API_KEY, la función responde con una guía local para que el
// chat de la landing y del ERP siga funcionando.
// ============================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMPRESA = {
  nombre: 'YiKev Stratos',
  ciudad: 'Quibdó',
  departamento: 'Chocó',
  especialidad: 'aluminio arquitectónico, vidrio templado, PVC y acrílico a medida',
  horario: 'Lunes a viernes 8:00 a.m. – 6:00 p.m. y sábados 8:00 a.m. – 12:00 m.',
  servicios: [
    'Ventanas corredizas, proyectantes y fijas',
    'Puertas y ventanales en aluminio o vidrio templado',
    'Fachadas flotantes y muros cortina',
    'Divisiones de baño en vidrio templado',
    'Barandas, espejos y piezas en acrílico',
    'Instalación, ajustes y mantenimiento',
  ],
};

const PROMPT_LANDING = `Eres el asistente virtual de ${EMPRESA.nombre}, un taller de ${EMPRESA.especialidad} en ${EMPRESA.ciudad}, ${EMPRESA.departamento}.
Hablas en español claro, cercano y profesional. Respuestas cortas (máximo 120 palabras), sin inventar precios exactos.
Servicios: ${EMPRESA.servicios.join('; ')}.
Horario: ${EMPRESA.horario}.
Cuando el usuario quiera cotizar, pídele medidas aproximadas, tipo de trabajo, ciudad y teléfono, e invítalo al formulario de contacto o WhatsApp.
Nunca prometas plazos exactos; explica que dependen de medidas, materiales y disponibilidad de vidrio templado.
Nunca reveles información interna del ERP, contraseñas ni datos de otros clientes.`;

const PROMPT_EMPLEADO = `Eres el asistente interno de ${EMPRESA.nombre} para el equipo del taller.
Respondes en español, de forma breve y operativa (máximo 150 palabras), con pasos concretos.
Flujo del ERP:
- Orden: se crea en “Órdenes y Medidas” por admin o jefe de taller. La dirección es obligatoria.
- La orden puede ir a medición (instalador) o directo a producción.
- Estados: Pendiente de Asignación, Asignado a Instalador, Cotización Pendiente, Pendiente de Producción, En Producción, Finalizado, Entregado.
- Al enviar a producción se calcula el despiece con la receta del sistema (cortes, vidrios, accesorios, mermas).
- Producción acepta el trabajo, envía medidas de vidrio al jefe y al terminar sube foto del producto terminado.
- Inventario de Producción: insumos del taller por colaborador, con stock actual y mínimo.
- Herramientas: el jefe/admin asigna; producción e instalación firman checklists de salida y entrada y registran novedades.
- Sistemas y Recetas solo los editan admin y jefe de taller.
No inventes datos de órdenes ni des acceso a información de otros usuarios. Si falta un dato, indica qué módulo revisar.`;

function respuestaLocal(texto: string, modo: string): string {
  const t = String(texto || '').toLowerCase();

  if (modo === 'empleado') {
    if (/(orden|produccion|despiece|taller)/.test(t)) {
      return (
        'Abre “Órdenes y Medidas”, verifica dirección y proyectos con medidas, y usa “Enviar a ' +
        'Producción” o “Aprobar y Enviar a Taller”. El despiece se calcula con la receta del sistema.'
      );
    }
    if (/(vidrio|medida)/.test(t)) {
      return (
        'En una orden “En Producción”, pulsa “Medidas de Vidrio”, confirma ancho, alto, cantidad y ' +
        'espesor, y envía. El jefe de taller recibe la notificación.'
      );
    }
    if (/(inventario|insumo|stock)/.test(t)) {
      return (
        'Usa “Inventario de Producción” para sumar, descontar o editar insumos. Si el stock baja del ' +
        'mínimo, avisa al jefe para reponerlo.'
      );
    }
    if (/(herramienta|checklist)/.test(t)) {
      return (
        'En “Herramientas y Checklists” firma la plantilla de salida o entrada, marca cada punto y ' +
        'registra las novedades.'
      );
    }
    return (
      'Puedo ayudarte con órdenes, medidas de vidrio, despiece, inventario de producción y ' +
      'herramientas. Dime qué módulo estás usando.'
    );
  }

  if (/(servicio|hacen|ofrecen|trabajan)/.test(t)) {
    return `Ofrecemos ${EMPRESA.servicios.slice(0, 4).join(', ')}, entre otros trabajos a medida.`;
  }
  if (/(cotiz|precio|valor|cuesta)/.test(t)) {
    return (
      'La cotización depende de medidas, sistema, vidrio y accesorios. Envíanos medidas aproximadas ' +
      'por el formulario de contacto o WhatsApp y te indicamos los siguientes pasos.'
    );
  }
  if (/(vidrio|templado|pvc|acrilico)/.test(t)) {
    return (
      'Trabajamos vidrio claro, bronce, gris, laminado y templado, además de PVC y acrílico. ' +
      'Para baños y barandas recomendamos templado de 8 a 10 mm según el diseño.'
    );
  }
  if (/(zona|ciudad|quibdo|choco|ubicacion)/.test(t)) {
    return `Estamos en ${EMPRESA.ciudad}, ${EMPRESA.departamento}, y atendemos municipios cercanos.`;
  }
  return (
    'Cuéntame si buscas ventanas, puertas, divisiones de baño, fachadas o espejos, y tu ciudad. ' +
    'También puedes usar el formulario de contacto para enviar las medidas.'
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let payload: {
    modo?: string;
    contexto?: Record<string, unknown>;
    mensajes?: Array<{ role?: string; content?: string }>;
  } = {};

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo JSON inválido' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const modo = payload.modo === 'empleado' ? 'empleado' : 'landing';
  const mensajes = Array.isArray(payload.mensajes) ? payload.mensajes : [];
  const ultimo = [...mensajes].reverse().find((m) => m.role === 'user')?.content || '';

  const apiKey = Deno.env.get('AI_API_KEY');
  const baseUrl = (Deno.env.get('AI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');
  const modelo = Deno.env.get('AI_MODEL') || 'gpt-4o-mini';

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        respuesta: respuestaLocal(ultimo, modo),
        origen: 'local',
        aviso: 'Configura AI_API_KEY en Supabase Edge Functions para activar la IA.',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const sistema = modo === 'empleado' ? PROMPT_EMPLEADO : PROMPT_LANDING;
  const contexto = payload.contexto ? JSON.stringify(payload.contexto).slice(0, 2000) : '';

  const cuerpo = {
    model: modelo,
    temperature: 0.4,
    max_tokens: 420,
    messages: [
      {
        role: 'system',
        content: contexto ? `${sistema}\nContexto actual del ERP: ${contexto}` : sistema,
      },
      ...mensajes
        .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'))
        .slice(-12)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
    ],
  };

  try {
    const respuesta = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error('Error del proveedor de IA:', respuesta.status, detalle);
      return new Response(
        JSON.stringify({
          respuesta: respuestaLocal(ultimo, modo),
          origen: 'local',
          aviso: 'El proveedor de IA no respondió. Se usó la guía local.',
        }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const datos = await respuesta.json();
    const texto = datos?.choices?.[0]?.message?.content;

    return new Response(
      JSON.stringify({
        respuesta: texto?.trim() || respuestaLocal(ultimo, modo),
        origen: texto ? 'ia' : 'local',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Fallo al consultar la IA:', err);
    return new Response(
      JSON.stringify({
        respuesta: respuestaLocal(ultimo, modo),
        origen: 'local',
        aviso: 'No se pudo contactar al proveedor de IA.',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
