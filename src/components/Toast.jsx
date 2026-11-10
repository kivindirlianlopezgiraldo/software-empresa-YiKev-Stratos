import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

const ESTILOS = {
  exito: {
    Icono: CheckCircle2,
    etiqueta: 'Completado',
    marco: 'border-emerald-400/30',
    resplandor: 'from-emerald-400/20',
    icono: 'bg-emerald-400/10 text-emerald-300 ring-emerald-300/20',
    barra: 'bg-emerald-400',
    punto: 'bg-emerald-300',
  },
  advertencia: {
    Icono: TriangleAlert,
    etiqueta: 'Atención',
    marco: 'border-amber-300/30',
    resplandor: 'from-amber-300/20',
    icono: 'bg-amber-300/10 text-amber-200 ring-amber-200/20',
    barra: 'bg-amber-300',
    punto: 'bg-amber-200',
  },
  info: {
    Icono: Info,
    etiqueta: 'Información',
    marco: 'border-sky-300/30',
    resplandor: 'from-sky-300/20',
    icono: 'bg-sky-300/10 text-sky-200 ring-sky-200/20',
    barra: 'bg-sky-300',
    punto: 'bg-sky-200',
  },
  error: {
    Icono: AlertCircle,
    etiqueta: 'No se pudo completar',
    marco: 'border-rose-300/30',
    resplandor: 'from-rose-300/20',
    icono: 'bg-rose-300/10 text-rose-200 ring-rose-200/20',
    barra: 'bg-rose-300',
    punto: 'bg-rose-200',
  },
};

const estiloDe = (tipo) => {
  if (tipo === 'exito' || tipo === 'success') return ESTILOS.exito;
  if (tipo === 'advertencia' || tipo === 'warning') return ESTILOS.advertencia;
  if (tipo === 'info') return ESTILOS.info;
  return ESTILOS.error;
};

export default function Toast({ alerta, onClose }) {
  if (!alerta?.visible) return null;

  const estilo = estiloDe(alerta.tipo);
  const Icono = estilo.Icono;
  const esUrgente = estilo === ESTILOS.error || estilo === ESTILOS.advertencia;

  return (
    <div
      key={alerta.id}
      className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex justify-center print:hidden sm:inset-x-auto sm:right-6 sm:top-6 sm:justify-end"
      role={esUrgente ? 'alert' : 'status'}
      aria-live={esUrgente ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <section
        className={`toast-card animate-toast-in pointer-events-auto relative isolate flex w-full max-w-[420px] overflow-hidden rounded-2xl border ${estilo.marco} bg-slate-950/95 text-white shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl`}
        style={{ '--toast-duration': `${alerta.duracion || 6000}ms` }}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute -right-10 -top-14 -z-10 h-40 w-40 rounded-full bg-gradient-to-br ${estilo.resplandor} to-transparent blur-3xl`}
        />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start gap-3.5">
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${estilo.icono}`}
              aria-hidden="true"
            >
              <Icono size={21} strokeWidth={2.2} />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {estilo.etiqueta}
                </span>
                <span className={`h-1 w-1 rounded-full ${estilo.punto}`} aria-hidden="true" />
                <span className="text-[9px] font-medium text-slate-500">YiKev Stratos</span>
              </div>
              <h4 className="break-words text-sm font-bold leading-snug text-white sm:text-[15px]">
                {alerta.titulo}
              </h4>
              {alerta.mensaje && (
                <p className="mt-1.5 break-words text-xs leading-relaxed text-slate-300">
                  {alerta.mensaje}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar notificación"
              className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <X size={17} />
            </button>
          </div>
        </div>
        <div
          className="toast-progress absolute inset-x-0 bottom-0 h-[2px] origin-left"
          aria-hidden="true"
        >
          <div className={`h-full w-full ${estilo.barra}`} />
        </div>
      </section>
    </div>
  );
}
