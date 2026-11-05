import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';

import {
  MENSAJE_BIENVENIDA_EMPLEADO,
  MENSAJE_BIENVENIDA_LANDING,
  SUGERENCIAS_EMPLEADO,
  SUGERENCIAS_LANDING,
  enviarMensajeChat,
} from '../lib/chat';

let contadorMensajes = 0;
const nuevoMensaje = (rol, contenido) => ({
  id: `msg-${Date.now()}-${(contadorMensajes += 1)}`,
  rol,
  contenido,
});

/**
 * Chat flotante reutilizable.
 * `modo="landing"` atiende al público; `modo="empleado"` responde con el
 * contexto del ERP y del usuario autenticado.
 */
export default function Chatbot({ modo = 'landing', contexto = {}, posicion = 'derecha' }) {
  const esEmpleado = modo === 'empleado';
  const bienvenida = esEmpleado ? MENSAJE_BIENVENIDA_EMPLEADO : MENSAJE_BIENVENIDA_LANDING;
  const sugerencias = esEmpleado ? SUGERENCIAS_EMPLEADO : SUGERENCIAS_LANDING;

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState(() => [nuevoMensaje('assistant', bienvenida)]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [origen, setOrigen] = useState(null);

  const finRef = useRef(null);
  const inputRef = useRef(null);
  const contextoRef = useRef(contexto);

  useEffect(() => {
    contextoRef.current = contexto;
  }, [contexto]);

  useEffect(() => {
    if (!abierto) return;
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [abierto, mensajes, enviando]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (evento) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', alPresionar);
    const temporizador = setTimeout(() => inputRef.current?.focus(), 120);
    return () => {
      document.removeEventListener('keydown', alPresionar);
      clearTimeout(temporizador);
    };
  }, [abierto]);

  const enviar = useCallback(
    async (contenidoCrudo) => {
      const contenido = String(contenidoCrudo ?? texto).trim();
      if (!contenido || enviando) return;

      const historial = [...mensajes, nuevoMensaje('user', contenido)];
      setMensajes(historial);
      setTexto('');
      setEnviando(true);
      setOrigen(null);

      const { texto: respuesta, origen: fuente } = await enviarMensajeChat({
        mensajes: historial.filter((mensaje) => mensaje.rol !== 'system'),
        modo,
        contexto: contextoRef.current,
      });

      setMensajes((prev) => [...prev, nuevoMensaje('assistant', respuesta)]);
      setOrigen(fuente);
      setEnviando(false);
    },
    [enviando, mensajes, modo, texto],
  );

  const alEnviar = (evento) => {
    evento.preventDefault();
    enviar();
  };

  const alTeclear = (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  };

  const sugerenciasVisibles = useMemo(
    () => sugerencias.filter((sugerencia) => !mensajes.some((m) => m.contenido === sugerencia)),
    [sugerencias, mensajes],
  );

  return (
    <div
      className={`fixed bottom-5 z-[60] flex flex-col gap-3 print:hidden ${
        posicion === 'izquierda' ? 'left-5 items-start' : 'right-5 items-end'
      }`}
    >
      {abierto && (
        <section
          role="dialog"
          aria-label={esEmpleado ? 'Asistente del taller' : 'Asistente de YiKev Stratos'}
          className="flex h-[510px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl shadow-blue-950/50"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-800 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-950 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-slate-950 shadow-lg shadow-blue-500/25">
                <Bot size={19} />
              </span>
              <div>
                <p className="text-xs font-black text-white">
                  {esEmpleado ? 'Asistente de taller' : 'Asistente YiKev'}
                </p>
                <p className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {enviando ? 'Escribiendo…' : 'En línea'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar asistente"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {mensajes.map((mensaje) => {
              const esUsuario = mensaje.rol === 'user';
              return (
                <div
                  key={mensaje.id}
                  className={`flex items-start gap-2 ${esUsuario ? 'flex-row-reverse' : ''}`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                      esUsuario
                        ? 'border-slate-700 bg-slate-800 text-slate-300'
                        : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    {esUsuario ? <User size={13} /> : <Sparkles size={13} />}
                  </span>
                  <p
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                      esUsuario
                        ? 'rounded-tr-sm bg-blue-600 text-white'
                        : 'rounded-tl-sm border border-slate-800 bg-slate-900 text-slate-200'
                    }`}
                  >
                    {mensaje.contenido}
                  </p>
                </div>
              );
            })}

            {enviando && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:240ms]" />
                </span>
                El asistente está respondiendo…
              </div>
            )}

            {!enviando && mensajes.length === 1 && sugerenciasVisibles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sugerenciasVisibles.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => enviar(sugerencia)}
                    className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-200 transition-colors hover:bg-blue-500/20"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            )}

            {origen === 'local' && (
              <p className="text-center text-[9px] text-slate-600">
                Respuesta guiada del taller · configura la IA para respuestas ampliadas
              </p>
            )}

            <div ref={finRef} />
          </div>

          <form onSubmit={alEnviar} className="border-t border-slate-800 bg-slate-900/70 p-2.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={alTeclear}
                placeholder={esEmpleado ? 'Pregunta sobre el taller…' : 'Escribe tu pregunta…'}
                aria-label="Mensaje para el asistente"
                className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                aria-label="Enviar mensaje"
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 disabled:opacity-40"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-slate-600">
              No compartas contraseñas ni datos sensibles.
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente virtual'}
        aria-expanded={abierto}
        className="group flex items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 px-4 py-3 text-xs font-bold text-white shadow-2xl shadow-blue-600/30 transition-transform hover:-translate-y-0.5"
      >
        {abierto ? <X size={18} /> : <MessageCircle size={18} />}
        <span className="hidden sm:inline">{abierto ? 'Cerrar' : 'Asistente IA'}</span>
      </button>
    </div>
  );
}
