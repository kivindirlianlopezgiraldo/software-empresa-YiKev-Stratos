import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Factory,
  Package,
  RefreshCw,
  Ruler,
  Wrench,
} from 'lucide-react';

import {
  cargarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  TIPOS_NOTIFICACION,
} from '../lib/notificaciones';
import { formatFechaHora } from '../lib/format';

import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const ESTILO_TIPO = {
  [TIPOS_NOTIFICACION.ORDEN]: {
    Icono: ClipboardList,
    clase: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  [TIPOS_NOTIFICACION.MEDIDA]: {
    Icono: Ruler,
    clase: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  [TIPOS_NOTIFICACION.PRODUCCION]: {
    Icono: Factory,
    clase: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
  [TIPOS_NOTIFICACION.HERRAMIENTA]: {
    Icono: Wrench,
    clase: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  [TIPOS_NOTIFICACION.SISTEMA]: {
    Icono: Package,
    clase: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  [TIPOS_NOTIFICACION.INFO]: {
    Icono: Bell,
    clase: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  },
};

function explicarError(err) {
  const texto = err?.message || '';
  if (/notificaciones|relation|does not exist|columna/i.test(texto)) {
    return (
      'Falta aplicar la migración 005 en Supabase (notificaciones). ' +
      'Ejecuta supabase/migrations/005_produccion_herramientas_ia.sql en el SQL Editor. ' +
      `Detalle: ${texto}`
    );
  }
  return texto;
}

export default function Notificaciones({ onVerOrden, onCambio }) {
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [filtro, setFiltro] = useState('TODAS');

  const { alerta, mostrar, cerrar } = useToast();

  const consultar = useCallback(async () => cargarNotificaciones(80), []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const filas = await consultar();
        if (!activo) return;
        setNotificaciones(filas);
        setError('');
      } catch (err) {
        if (activo) setError(explicarError(err));
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultar, recarga]);

  const refrescar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const marcarLeida = async (notificacion) => {
    if (notificacion.leida) return;
    try {
      await marcarNotificacionLeida(notificacion.id);
      setNotificaciones((prev) =>
        prev.map((fila) => (fila.id === notificacion.id ? { ...fila, leida: true } : fila)),
      );
      if (onCambio) onCambio();
    } catch (err) {
      mostrar('No se pudo marcar', explicarError(err));
    }
  };

  const marcarTodas = async () => {
    const pendientes = notificaciones.filter((fila) => !fila.leida).map((fila) => fila.id);
    if (!pendientes.length) {
      mostrar('Todo al día', 'No tienes notificaciones sin leer.', 'exito');
      return;
    }
    try {
      await marcarTodasLeidas(pendientes);
      setNotificaciones((prev) => prev.map((fila) => ({ ...fila, leida: true })));
      if (onCambio) onCambio();
      mostrar('Notificaciones leídas', 'Se marcaron todas como leídas.', 'exito');
    } catch (err) {
      mostrar('No se pudieron marcar', explicarError(err));
    }
  };

  const abrir = async (notificacion) => {
    await marcarLeida(notificacion);
    if (notificacion.orden_id && onVerOrden) onVerOrden(notificacion.orden_id);
  };

  const filtradas = useMemo(() => {
    if (filtro === 'SIN_LEER') return notificaciones.filter((fila) => !fila.leida);
    if (filtro === 'LEIDAS') return notificaciones.filter((fila) => fila.leida);
    return notificaciones;
  }, [notificaciones, filtro]);

  const sinLeer = useMemo(
    () => notificaciones.filter((fila) => !fila.leida).length,
    [notificaciones],
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Notificaciones</h1>
          <p className="text-xs text-slate-400 mt-1">
            Avisos de órdenes, medidas, producción y herramientas para tu rol.
            {sinLeer > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-blue-400 font-semibold">
                <Bell size={12} /> {sinLeer} sin leer
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refrescar}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all"
          >
            <RefreshCw size={15} /> Actualizar
          </button>
          <button
            type="button"
            onClick={marcarTodas}
            disabled={sinLeer === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <CheckCheck size={15} /> Marcar todas
          </button>
        </div>
      </div>

      <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1.5 sm:w-fit">
        {[
          { id: 'TODAS', etiqueta: 'Todas' },
          { id: 'SIN_LEER', etiqueta: `Sin leer${sinLeer ? ` (${sinLeer})` : ''}` },
          { id: 'LEIDAS', etiqueta: 'Leídas' },
        ].map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            onClick={() => setFiltro(opcion.id)}
            aria-pressed={filtro === opcion.id}
            className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              filtro === opcion.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-950/60 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs"
        >
          <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={refrescar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-semibold shrink-0"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-slate-500 py-10 text-center">Cargando notificaciones...</p>
      ) : filtradas.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-10 text-center">
          <BellOff className="mx-auto text-slate-600" size={30} />
          <p className="text-sm font-bold text-slate-300 mt-3">No hay notificaciones</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {filtro === 'SIN_LEER'
              ? 'Estás al día: no tienes avisos pendientes.'
              : 'Cuando haya novedades en tus órdenes o herramientas aparecerán aquí.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((notificacion) => {
            const estilo = ESTILO_TIPO[notificacion.tipo] || ESTILO_TIPO[TIPOS_NOTIFICACION.INFO];
            const Icono = estilo.Icono;
            return (
              <button
                key={notificacion.id}
                type="button"
                onClick={() => abrir(notificacion)}
                className={`w-full text-left bg-slate-900 border rounded-2xl p-4 flex items-start gap-3 transition-all ${
                  notificacion.leida
                    ? 'border-slate-800 hover:border-slate-700'
                    : 'border-blue-500/40 hover:border-blue-500/60 shadow-lg shadow-blue-900/10'
                }`}
              >
                <span
                  className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center ${estilo.clase}`}
                >
                  <Icono size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs ${
                        notificacion.leida ? 'font-semibold text-slate-300' : 'font-black text-white'
                      }`}
                    >
                      {notificacion.titulo}
                    </span>
                    {!notificacion.leida && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                    )}
                  </span>
                  {notificacion.mensaje && (
                    <span className="block text-[11px] text-slate-400 mt-1 whitespace-pre-wrap">
                      {notificacion.mensaje}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatFechaHora(notificacion.creado_en)}
                    </span>
                    {notificacion.orden_id && (
                      <span className="text-[10px] text-blue-400 inline-flex items-center gap-1">
                        <CheckCircle2 size={10} /> Ver orden
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
