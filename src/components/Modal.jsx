import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ abierto, titulo, subtitulo, icono, onClose, children, ancho = 'max-w-md' }) {
  useEffect(() => {
    if (!abierto) return undefined;

    const alPresionar = (evento) => {
      if (evento.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onClose]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full ${ancho} p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-modal-in`}
      >
        <div className="flex justify-between items-start gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-2 min-w-0">
            {icono && <span className="text-blue-500 mt-0.5 shrink-0">{icono}</span>}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white break-words">{titulo}</h2>
              {subtitulo && <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
