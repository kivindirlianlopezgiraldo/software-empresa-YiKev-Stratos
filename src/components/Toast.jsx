import { CheckCircle, ShieldAlert, X } from 'lucide-react';

export default function Toast({ alerta, onClose }) {
  if (!alerta?.visible) return null;

  const esExito = alerta.tipo === 'exito';

  return (
    <div className="fixed top-6 right-6 z-[100] animate-toast-in print:hidden" role="status" aria-live="polite">
      <div
        className={`flex items-start gap-4 p-4 rounded-2xl shadow-2xl border max-w-md w-full ${
          esExito
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
            : 'bg-red-950/95 border-red-500/50 text-red-200'
        }`}
      >
        <div
          className={`p-2.5 rounded-xl shrink-0 ${
            esExito ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {esExito ? <CheckCircle size={22} /> : <ShieldAlert size={22} />}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-white break-words">{alerta.titulo}</h4>
          <p className="text-xs mt-1 opacity-90 leading-relaxed break-words">{alerta.mensaje}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className="text-white/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
