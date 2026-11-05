import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Ruler,
  Users,
  Wrench,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { ESTADOS } from '../lib/constants';

const METRICAS_INICIALES = {
  totalOrdenes: 0,
  pendientesMedida: 0,
  enProceso: 0,
  finalizadas: 0,
  totalInventario: 0,
  totalColaboradores: 0,
};

export default function Dashboard({ perfil }) {
  const [metricas, setMetricas] = useState(METRICAS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  const consultarMetricas = useCallback(async () => {
    const [resOrdenes, resInventario, resColaboradores] = await Promise.all([
      supabase.from('ordenes_trabajo').select('estado'),
      supabase.from('inventario_materiales').select('*', { count: 'exact', head: true }),
      supabase.from('perfiles_usuario').select('*', { count: 'exact', head: true }),
    ]);

    if (resOrdenes.error) throw resOrdenes.error;
    if (resInventario.error) throw resInventario.error;
    if (resColaboradores.error) throw resColaboradores.error;

    const ordenes = resOrdenes.data ?? [];

    return {
      totalOrdenes: ordenes.length,
      pendientesMedida: ordenes.filter(
        (o) => o.estado === ESTADOS.PENDIENTE_ASIGNACION || o.estado === ESTADOS.ASIGNADO_INSTALADOR,
      ).length,
      enProceso: ordenes.filter(
        (o) => o.estado === ESTADOS.COTIZACION_PENDIENTE || o.estado === ESTADOS.EN_PRODUCCION,
      ).length,
      finalizadas: ordenes.filter(
        (o) => o.estado === ESTADOS.FINALIZADO || o.estado === ESTADOS.ENTREGADO,
      ).length,
      totalInventario: resInventario.count ?? 0,
      totalColaboradores: resColaboradores.count ?? 0,
    };
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const resultado = await consultarMetricas();
        if (!activo) return;
        setMetricas(resultado);
        setError('');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar las métricas.');
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarMetricas, recarga]);

  const recargar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const valor = (cantidad) => (cargando ? '…' : cantidad);

  const tarjetas = [
    {
      etiqueta: 'Pendientes de Medida',
      valor: metricas.pendientesMedida,
      icono: <Ruler size={20} />,
      detalle: 'Instaladores',
      color: 'purple',
    },
    {
      etiqueta: 'En Proceso',
      valor: metricas.enProceso,
      icono: <Clock size={20} />,
      detalle: 'Cotización / Taller',
      color: 'amber',
    },
    {
      etiqueta: 'Finalizadas / Entregadas',
      valor: metricas.finalizadas,
      icono: <CheckCircle2 size={20} />,
      detalle: 'Completadas',
      color: 'emerald',
    },
    {
      etiqueta: 'Total Órdenes Registradas',
      valor: metricas.totalOrdenes,
      icono: <Wrench size={20} />,
      detalle: 'Global',
      color: 'blue',
    },
  ];

  const ESTILOS = {
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
            {perfil?.rol || 'Sin rol'}
          </span>
          <h1 className="text-2xl font-black text-white mt-2">
            ¡Bienvenido, {perfil?.nombre_completo || 'Colaborador'}!
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Panel general de operaciones del taller de Aluminio, Vidrio, PVC y Acrílico en Quibdó.
          </p>
        </div>

        <button
          type="button"
          onClick={recargar}
          disabled={cargando}
          className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 transition-all disabled:opacity-50"
        >
          <span
            className={`w-2 h-2 rounded-full ${cargando ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}
          />
          {cargando ? 'Actualizando…' : 'Sistema Sincronizado'}
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-950/60 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs"
        >
          <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-white">No se pudieron cargar las métricas</p>
            <p className="mt-0.5 opacity-90">{error}</p>
          </div>
          <button
            type="button"
            onClick={recargar}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-semibold transition-colors shrink-0"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tarjetas.map(({ etiqueta, valor: cantidad, icono, detalle, color }) => (
          <div
            key={etiqueta}
            className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 border rounded-2xl ${ESTILOS[color]}`}>{icono}</div>
              <span className={`text-xs font-mono font-bold ${ESTILOS[color].split(' ').pop()}`}>
                {detalle}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-400 font-medium">{etiqueta}</p>
              <p className="text-2xl font-black text-white mt-1">{valor(cantidad)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inventario y personal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-400">
              <Box size={20} />
              <h3 className="text-sm font-bold text-white">Inventario de Materiales</h3>
            </div>
            <p className="text-xs text-slate-400">
              Perfiles de aluminio, vidrios, empaques y accesorios registrados.
            </p>
            <p className="text-2xl font-black text-blue-400 font-mono mt-2">
              {valor(metricas.totalInventario)} ítems
            </p>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400">
            <Layers size={32} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400">
              <Users size={20} />
              <h3 className="text-sm font-bold text-white">Equipo de Colaboradores</h3>
            </div>
            <p className="text-xs text-slate-400">
              Personal activo en taller, áreas de corte, vidrio e instalación.
            </p>
            <p className="text-2xl font-black text-purple-400 font-mono mt-2">
              {valor(metricas.totalColaboradores)} miembros
            </p>
          </div>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-slate-400">
            <Users size={32} />
          </div>
        </div>
      </div>
    </div>
  );
}
