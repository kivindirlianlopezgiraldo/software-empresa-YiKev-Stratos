import { CheckCircle, ShieldAlert, X } from 'lucide-react';

export default function Toast({ alerta, onClose }) {
  if (!alerta?.visible) return null;

  const esExito = alerta.tipo === 'exito';

  return (
    <div
      className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex justify-end animate-toast-in print:hidden sm:inset-x-auto sm:right-6 sm:top-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3 shadow-2xl sm:gap-4 sm:p-4 ${
          esExito
            ? 'border-emerald-500/50 bg-emerald-950/95 text-emerald-200'
            : 'border-red-500/50 bg-red-950/95 text-red-200'
        }`}
      >
        <div
          className={`shrink-0 rounded-xl p-2 sm:p-2.5 ${
            esExito ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
          aria-hidden="true"
        >
          {esExito ? <CheckCircle size={20} /> : <ShieldAlert size={20} />}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="break-words text-sm font-black text-white">{alerta.titulo}</h4>
          <p className="mt-1 break-words text-xs leading-relaxed opacity-90">{alerta.mensaje}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className="shrink-0 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
