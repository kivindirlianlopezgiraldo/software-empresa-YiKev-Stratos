import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  abierto,
  titulo,
  subtitulo,
  icono,
  onClose,
  children,
  ancho = 'max-w-md',
}) {
  const idTitulo = useId();
  const idSubtitulo = useId();
  const contenedorRef = useRef(null);
  const enfocadoPrevioRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!abierto) return undefined;

    enfocadoPrevioRef.current = document.activeElement;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Llevar el foco al diálogo para que se anuncie en lectores de pantalla.
    const temporizador = setTimeout(() => contenedorRef.current?.focus(), 30);

    const alPresionar = (evento) => {
      if (evento.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }

      // Mantener el foco dentro del modal mientras está abierto.
      if (evento.key !== 'Tab' || !contenedorRef.current) return;

      const focos = contenedorRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focos.length) return;

      const primero = focos[0];
      const ultimo = focos[focos.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPresionar);

    return () => {
      clearTimeout(temporizador);
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;

      const previo = enfocadoPrevioRef.current;
      if (previo && typeof previo.focus === 'function') previo.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div
        ref={contenedorRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={subtitulo ? idSubtitulo : undefined}
        tabIndex={-1}
        className={`relative w-full ${ancho} max-h-[92dvh] animate-modal-in space-y-4 overflow-y-auto overscroll-contain rounded-t-3xl border border-slate-800 bg-slate-900 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl focus:outline-none sm:space-y-5 sm:rounded-3xl sm:p-6`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3 sm:gap-4 sm:pb-4">
          <div className="flex min-w-0 items-start gap-2">
            {icono && (
              <span className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true">
                {icono}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={idTitulo} className="break-words text-base font-bold text-white">
                {titulo}
              </h2>
              {subtitulo && (
                <p id={idSubtitulo} className="mt-0.5 text-xs text-slate-400">
                  {subtitulo}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
