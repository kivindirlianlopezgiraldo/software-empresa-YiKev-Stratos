import { useEffect, useState } from 'react';
import { CalendarClock, ShieldAlert } from 'lucide-react';

import { supabase } from '../lib/supabase';
import Modal from './Modal';

function fechaHoraBogota(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}T${valores.hour}:${valores.minute}`;
}

function explicarError(error) {
  const mensaje = error?.message || 'No se pudo extender el acceso.';
  if (/herramienta_accesos_extendidos/i.test(mensaje)) {
    return `Falta aplicar la migración 014 de extensiones de horario en Supabase. Detalle: ${mensaje}`;
  }
  return mensaje;
}

export default function ExtenderAccesoModal({ abierto, perfil, onClose, onGuardado }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [venceEn, setVenceEn] = useState(() => fechaHoraBogota(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [motivo, setMotivo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!abierto) return undefined;
    let activo = true;

    supabase
      .from('perfiles_usuario')
      .select('id, nombre_completo, rol, activo')
      .order('nombre_completo', { ascending: true })
      .then(({ data, error: errorConsulta }) => {
        if (!activo) return;
        if (errorConsulta) throw errorConsulta;
        const filasActivas = (data || []).filter((fila) => fila.activo !== false);
        setColaboradores(filasActivas);
        setColaboradorId((actual) =>
          filasActivas.some((fila) => fila.id === actual) ? actual : '',
        );
      })
      .catch((errorCarga) => {
        if (activo) setError(errorCarga.message || 'No se pudieron cargar los empleados.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [abierto]);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (guardando) return;

    const expiracion = new Date(`${venceEn}:00-05:00`);
    if (!colaboradorId) {
      setError('Selecciona el empleado que necesita continuar trabajando.');
      return;
    }
    if (Number.isNaN(expiracion.getTime()) || expiracion <= new Date()) {
      setError('La fecha y hora de vencimiento deben ser posteriores a este momento.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const { error: errorInsert } = await supabase.from('herramienta_accesos_extendidos').insert({
        usuario_id: colaboradorId,
        vence_en: expiracion.toISOString(),
        motivo: motivo.trim() || null,
        concedido_por: perfil?.id ?? null,
        concedido_por_nombre: perfil?.nombre_completo ?? null,
      });
      if (errorInsert) throw errorInsert;

      const colaborador = colaboradores.find((fila) => fila.id === colaboradorId);
      setMensaje(`El acceso de ${colaborador?.nombre_completo || 'el empleado'} estará habilitado hasta ${new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(expiracion)}.`);
      setMotivo('');
      onGuardado?.();
    } catch (errorGuardar) {
      setError(explicarError(errorGuardar));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onClose={onClose}
      icono={<CalendarClock size={20} />}
      titulo="Extender acceso fuera de horario"
      subtitulo="Concede acceso temporal a un empleado. Se cerrará automáticamente al vencer."
      ancho="max-w-lg"
    >
      <form onSubmit={guardar} className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <ShieldAlert size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {mensaje && (
          <p role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            {mensaje}
          </p>
        )}

        <label className="block space-y-1 text-xs font-semibold text-slate-300">
          Empleado
          <select
            required
            value={colaboradorId}
            onChange={(evento) => setColaboradorId(evento.target.value)}
            disabled={cargando}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">{cargando ? 'Cargando empleados...' : 'Selecciona un empleado...'}</option>
            {colaboradores.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nombre_completo} · {colaborador.rol}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1 text-xs font-semibold text-slate-300">
          Acceso permitido hasta (hora de Colombia)
          <input
            type="datetime-local"
            required
            value={venceEn}
            min={fechaHoraBogota(new Date())}
            onChange={(evento) => setVenceEn(evento.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block space-y-1 text-xs font-semibold text-slate-300">
          Motivo (opcional)
          <textarea
            rows="2"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Ej. Instalación demorada en obra"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300">
            Cerrar
          </button>
          <button
            type="submit"
            disabled={guardando || cargando || !colaboradores.length || Boolean(mensaje)}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : mensaje ? 'Acceso extendido' : 'Extender acceso'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
