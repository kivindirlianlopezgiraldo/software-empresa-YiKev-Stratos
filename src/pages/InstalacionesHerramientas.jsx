import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Package, Wrench } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatFechaHora } from '../lib/format';
import { rolLegible } from '../lib/constants';

const ESTADO_INICIAL = {
  instaladorId: '',
  ordenId: '',
  kitId: '',
  plantillaId: '',
  herramientasIds: [],
  marcados: [],
  novedad: '',
};

function normalizarNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sugerirHerramientas(kit, disponibles) {
  const restantes = [...disponibles];
  const seleccionadas = [];
  (kit?.items || []).forEach((item) => {
    const nombre = normalizarNombre(item?.nombre ?? item);
    const cantidad = Math.max(1, Number(item?.cantidad) || 1);
    for (let indice = 0; indice < cantidad; indice += 1) {
      const posicion = restantes.findIndex((herramienta) =>
        normalizarNombre(herramienta.nombre).includes(nombre),
      );
      if (posicion === -1) break;
      seleccionadas.push(restantes[posicion].id);
      restantes.splice(posicion, 1);
    }
  });
  return seleccionadas;
}

function explicarError(error) {
  if (/iniciar_salida_instalacion|finalizar_salida_instalacion|herramienta_instalaciones/i.test(error?.message || '')) {
    return `Falta aplicar la migración 012 de salidas de instalación en Supabase. Detalle: ${error.message}`;
  }
  return error?.message || 'Ocurrió un error inesperado.';
}

function ListaChecklist({ plantilla, marcados, onChange, idPrefijo }) {
  if (!plantilla) return null;

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <legend className="px-1 text-[11px] font-semibold text-slate-300">{plantilla.nombre}</legend>
      {(plantilla.items || []).map((item, index) => (
        <label key={`${idPrefijo}-${index}`} className="flex items-start gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={marcados.includes(index)}
            onChange={() =>
              onChange(
                marcados.includes(index)
                  ? marcados.filter((value) => value !== index)
                  : [...marcados, index],
              )
            }
            className="mt-0.5 accent-cyan-500"
          />
          <span>{item}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function InstalacionesHerramientas({
  perfil,
  colaboradores,
  herramientas,
  ordenes,
  kits,
  plantillas,
  onAdminKits,
  onRefrescar,
}) {
  const [salidas, setSalidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalSalida, setModalSalida] = useState(false);
  const [modalCierre, setModalCierre] = useState(null);
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [marcadosCierre, setMarcadosCierre] = useState([]);
  const [novedadCierre, setNovedadCierre] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarSalidas = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from('herramienta_instalaciones')
      .select('*')
      .order('salida_en', { ascending: false })
      .limit(100);

    if (errorConsulta) throw errorConsulta;
    return data ?? [];
  }, []);

  const refrescarSalidas = useCallback(async () => {
    try {
      setError('');
      setSalidas(await cargarSalidas());
    } catch (errorCarga) {
      setError(explicarError(errorCarga));
    } finally {
      setCargando(false);
    }
  }, [cargarSalidas]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const filas = await cargarSalidas();
        if (activo) {
          setSalidas(filas);
          setError('');
        }
      } catch (errorCarga) {
        if (activo) setError(explicarError(errorCarga));
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [cargarSalidas]);

  const instaladores = useMemo(
    () => colaboradores.filter((persona) => /instalad/i.test(rolLegible(persona.rol))),
    [colaboradores],
  );
  const kitsInstalacion = useMemo(
    () => kits.filter((kit) => kit.rol_destino === 'instalador' && kit.activo !== false),
    [kits],
  );
  const checklistSalida = useMemo(
    () => plantillas.find((plantilla) => plantilla.id === form.plantillaId) || null,
    [plantillas, form.plantillaId],
  );
  const checklistCierre = useMemo(
    () => plantillas.find((plantilla) => plantilla.tipo === 'entrada' && plantilla.activo !== false) || null,
    [plantillas],
  );
  const herramientasDisponibles = useMemo(
    () =>
      herramientas
        .filter((herramienta) => !herramienta.colaborador_id && !['Mantenimiento', 'Perdida', 'Dañada'].includes(herramienta.estado))
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
    [herramientas],
  );
  const herramientasSeleccionadas = useMemo(
    () => herramientasDisponibles.filter((herramienta) => form.herramientasIds.includes(herramienta.id)),
    [herramientasDisponibles, form.herramientasIds],
  );
  const kitSeleccionado = kitsInstalacion.find((kit) => kit.id === form.kitId);
  const faltantesKit = useMemo(() => {
    const restantes = [...herramientasSeleccionadas];
    const faltantes = [];
    (kitSeleccionado?.items || []).forEach((item) => {
      const nombre = String(item?.nombre ?? item ?? '');
      const patron = normalizarNombre(nombre);
      const cantidad = Math.max(1, Number(item?.cantidad) || 1);
      let encontradas = 0;
      for (let indice = 0; indice < cantidad; indice += 1) {
        const posicion = restantes.findIndex((herramienta) =>
          normalizarNombre(herramienta.nombre).includes(patron),
        );
        if (posicion === -1) break;
        encontradas += 1;
        restantes.splice(posicion, 1);
      }
      if (encontradas < cantidad) faltantes.push(`${nombre} × ${cantidad - encontradas}`);
    });
    return faltantes;
  }, [herramientasSeleccionadas, kitSeleccionado]);
  const ordenPorId = useMemo(() => new Map(ordenes.map((orden) => [orden.id, orden])), [ordenes]);
  const salidasPorInstalador = useMemo(
    () =>
      instaladores.map((instalador) => ({
        ...instalador,
        salidas: salidas.filter(
          (salida) => salida.estado === 'en_curso' && salida.instalador_id === instalador.id,
        ),
      })),
    [instaladores, salidas],
  );

  const abrirSalida = (instaladorId = '') => {
    const checklist = plantillas.find((plantilla) => plantilla.tipo === 'salida' && plantilla.activo !== false);
    const kitBase = kitsInstalacion.find((kit) => /kit de instalaci[oó]n/i.test(kit.nombre));
    const kitInicial = kitBase || kitsInstalacion[0] || null;
    setForm({
      ...ESTADO_INICIAL,
      instaladorId,
      kitId: kitInicial?.id || '',
      herramientasIds: sugerirHerramientas(kitInicial, herramientasDisponibles),
      plantillaId: checklist?.id || '',
    });
    setError('');
    setModalSalida(true);
  };

  const actualizarSalida = async (evento) => {
    evento.preventDefault();
    const kit = kitsInstalacion.find((item) => item.id === form.kitId);
    if (!form.instaladorId || !form.ordenId || !kit) {
      setError('Selecciona el instalador, la orden de trabajo y un kit de instalación.');
      return;
    }
    if (!checklistSalida || checklistSalida.items.length === 0) {
      setError('Configura una lista de chequeo de salida para poder registrar la entrega.');
      return;
    }
    if (form.marcados.length !== checklistSalida.items.length) {
      setError('Completa todos los puntos del chequeo antes de entregar las herramientas.');
      return;
    }
    if (!form.herramientasIds.length) {
      setError('Selecciona las herramientas que se entregan para esta instalación.');
      return;
    }
    if (faltantesKit.length) {
      setError(`Completa las herramientas requeridas por el kit: ${faltantesKit.join(', ')}.`);
      return;
    }

    const itemsChecklist = checklistSalida.items.map((texto, index) => ({
      texto,
      marcado: form.marcados.includes(index),
    }));
    setGuardando(true);
    setError('');

    try {
      const { error: errorRPC } = await supabase.rpc('iniciar_salida_instalacion', {
        p_orden_id: form.ordenId,
        p_instalador_id: form.instaladorId,
        p_kit_id: kit.id,
        p_herramientas_ids: form.herramientasIds,
        p_checklist_salida: itemsChecklist,
        p_checklist_nombre: checklistSalida.nombre,
        p_novedad: form.novedad.trim() || null,
        p_registrado_por_nombre: perfil?.nombre_completo || null,
      });
      if (errorRPC) throw errorRPC;

      setModalSalida(false);
      setForm(ESTADO_INICIAL);
      await Promise.all([refrescarSalidas(), onRefrescar()]);
    } catch (errorGuardar) {
      setError(explicarError(errorGuardar));
    } finally {
      setGuardando(false);
    }
  };

  const finalizarInstalacion = async (evento) => {
    evento.preventDefault();
    if (!modalCierre || !checklistCierre || checklistCierre.items.length === 0) {
      setError('Configura un checklist de entrada para poder cerrar la instalación.');
      return;
    }
    if (marcadosCierre.length !== checklistCierre.items.length) {
      setError('Completa todos los puntos del chequeo de retorno para cerrar la instalación.');
      return;
    }

    setGuardando(true);
    setError('');
    try {
      const { error: errorRPC } = await supabase.rpc('finalizar_salida_instalacion', {
        p_instalacion_id: modalCierre.id,
        p_checklist_retorno: checklistCierre.items.map((texto, index) => ({
          texto,
          marcado: marcadosCierre.includes(index),
        })),
        p_checklist_nombre: checklistCierre.nombre,
        p_novedad: novedadCierre.trim() || null,
        p_registrado_por_nombre: perfil?.nombre_completo || null,
      });
      if (errorRPC) throw errorRPC;

      setModalCierre(null);
      setMarcadosCierre([]);
      setNovedadCierre('');
      await Promise.all([refrescarSalidas(), onRefrescar()]);
    } catch (errorGuardar) {
      setError(explicarError(errorGuardar));
    } finally {
      setGuardando(false);
    }
  };

  const claseCampo =
    'w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none';
  const activas = salidas.filter((salida) => salida.estado === 'en_curso');

  return (
    <section className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-white">
            <Package size={17} className="text-cyan-400" /> Kits y salidas de instalación
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Asigna un kit a cada orden, registra el chequeo de salida y confirma el retorno al terminar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAdminKits} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:bg-slate-700">
            Administrar kits
          </button>
          <button type="button" onClick={abrirSalida} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-cyan-600">
            <ArrowUpRight size={14} /> Nueva salida
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Kits de instalación', kitsInstalacion.length],
          ['En instalación', activas.length],
          ['Salidas registradas', salidas.length],
        ].map(([label, count]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
            <span className="text-[11px] text-slate-400">{label}</span>
            <strong className="font-mono text-lg text-cyan-300">{count}</strong>
          </div>
        ))}
      </div>

      {(!kitsInstalacion.length ||
        !instaladores.length ||
        !ordenes.length ||
        !plantillas.some((item) => item.tipo === 'salida' && item.activo !== false) ||
        !checklistCierre) && (
        <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
          <p className="font-bold">Antes de registrar una salida, completa la configuración:</p>
          {!kitsInstalacion.length && <p>• Crea un kit con destino Instalación en “Kits por rol”.</p>}
          {!instaladores.length && <p>• Registra o activa al menos un empleado con rol Instalador.</p>}
          {!ordenes.length && <p>• Registra una orden de trabajo para asociar la visita.</p>}
          {!plantillas.some((item) => item.tipo === 'salida' && item.activo !== false) && (
            <p>• Activa un checklist de tipo Salida en “Checklists”.</p>
          )}
          {!checklistCierre && <p>• Activa un checklist de tipo Entrada para el chequeo de retorno.</p>}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Kits asignados por instalador</h3>
          <p className="mt-1 text-[10px] text-slate-500">
            Cada tarjeta reúne las herramientas de sus salidas activas. Para agregar más, asigna un kit en otra salida y selecciona también las herramientas adicionales.
          </p>
        </div>
        {cargando ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-xs text-slate-500">Cargando asignaciones...</p>
        ) : salidasPorInstalador.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-xs text-slate-500">No hay instaladores activos registrados.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {salidasPorInstalador.map((instalador) => {
              const cantidadHerramientas = instalador.salidas.reduce(
                (total, salida) => total + (salida.herramientas?.length || 0),
                0,
              );
              return (
                <article key={instalador.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{instalador.nombre_completo}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Instalador · {instalador.salidas.length} {instalador.salidas.length === 1 ? 'salida activa' : 'salidas activas'} · {cantidadHerramientas} {cantidadHerramientas === 1 ? 'herramienta' : 'herramientas'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirSalida(instalador.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white transition-colors hover:bg-blue-500"
                    >
                      <ArrowUpRight size={13} /> Asignar kit
                    </button>
                  </header>

                  {instalador.salidas.length === 0 ? (
                    <p className="px-4 py-5 text-center text-[11px] text-slate-500">
                      Sin salida activa. Asigna un kit para registrar la próxima instalación.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-800/70">
                      {instalador.salidas.map((salida) => {
                        const orden = ordenPorId.get(salida.orden_id);
                        return (
                          <div key={salida.id} className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-bold text-white">
                                  {orden?.codigo_orden || 'Orden'} · {orden?.cliente_nombre || 'Cliente'}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-400">
                                  {salida.kit_nombre} · Salida: {formatFechaHora(salida.salida_en)}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-300">EN CURSO</span>
                            </div>
                            <ul className="space-y-1">
                              {(salida.herramientas || []).map((item) => (
                                <li key={item.id} className="flex items-center gap-2 text-[10px] text-slate-300">
                                  <Wrench size={12} className="text-slate-500" /> {item.nombre} · {item.codigo || 'Sin código'}
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => {
                                setError('');
                                setMarcadosCierre([]);
                                setNovedadCierre('');
                                setModalCierre(salida);
                              }}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-600"
                            >
                              <ArrowDownLeft size={14} /> Chequeo y cierre de instalación
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Historial reciente</h3>
        {salidas.filter((salida) => salida.estado === 'finalizada').slice(0, 10).map((salida) => {
          const orden = ordenPorId.get(salida.orden_id);
          return (
            <div key={salida.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-white">{orden?.codigo_orden || 'Orden'} · {orden?.cliente_nombre || 'Cliente'}</p>
                <p className="mt-1 text-[10px] text-slate-500">{salida.instalador_nombre} · {salida.kit_nombre}</p>
              </div>
              <span className="text-[10px] text-emerald-300">
                Finalizada · {formatFechaHora(salida.retorno_en)}
              </span>
            </div>
          );
        })}
      </div>

      {modalSalida && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form onSubmit={actualizarSalida} className="max-h-[92dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-5 sm:rounded-3xl">
            <div>
              <h3 className="text-base font-bold text-white">Salida a instalación</h3>
              <p className="mt-1 text-xs text-slate-400">Registra esta salida y completa el chequeo antes de salir. Puedes sumar herramientas además de las incluidas en el kit.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-semibold text-slate-300">
                Instalador
                <select required value={form.instaladorId} onChange={(event) => setForm((prev) => ({ ...prev, instaladorId: event.target.value }))} className={claseCampo}>
                  <option value="">Selecciona instalador...</option>
                  {instaladores.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre_completo} · {rolLegible(persona.rol)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-300">
                Orden de trabajo
                <select required value={form.ordenId} onChange={(event) => setForm((prev) => ({ ...prev, ordenId: event.target.value }))} className={claseCampo}>
                  <option value="">Selecciona orden...</option>
                  {ordenes.map((orden) => <option key={orden.id} value={orden.id}>{orden.codigo_orden} · {orden.cliente_nombre}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-300">
                Kit de instalación
                <select required value={form.kitId} onChange={(event) => {
                  const kit = kitsInstalacion.find((item) => item.id === event.target.value);
                  setForm((prev) => ({
                    ...prev,
                    kitId: event.target.value,
                    herramientasIds: sugerirHerramientas(kit, herramientasDisponibles),
                  }));
                }} className={claseCampo}>
                  <option value="">Selecciona kit...</option>
                  {kitsInstalacion.map((kit) => <option key={kit.id} value={kit.id}>{kit.nombre}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-300">
                Chequeo antes de salir
                <select required value={form.plantillaId} onChange={(event) => setForm((prev) => ({ ...prev, plantillaId: event.target.value, marcados: [] }))} className={claseCampo}>
                  <option value="">Selecciona chequeo...</option>
                  {plantillas.filter((item) => item.tipo === 'salida' && item.activo !== false).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
            </div>

            {kitSeleccionado && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="text-[11px] font-semibold text-blue-200">Contenido del kit: {kitSeleccionado.nombre}</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {(kitSeleccionado.items || []).map((item, index) => (
                    <li key={`${item.nombre}-${index}`} className="text-[10px] text-slate-300">
                      {item.nombre} × {item.cantidad || 1}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="mb-1 text-[11px] font-semibold text-slate-300">Herramientas físicas para esta salida</legend>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2">
                {herramientasDisponibles.length === 0 ? (
                  <p className="p-3 text-center text-[11px] text-slate-500">No hay herramientas disponibles en inventario.</p>
                ) : herramientasDisponibles.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 border-b border-slate-800/60 px-2 py-2 text-[11px] text-slate-300 last:border-0">
                    <input type="checkbox" checked={form.herramientasIds.includes(item.id)} onChange={() => setForm((prev) => ({ ...prev, herramientasIds: prev.herramientasIds.includes(item.id) ? prev.herramientasIds.filter((id) => id !== item.id) : [...prev.herramientasIds, item.id] }))} className="accent-cyan-500" />
                    <span>{item.nombre} · {item.codigo || 'Sin código'}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">{herramientasSeleccionadas.length} herramienta(s) seleccionada(s). El kit sugiere las iniciales; puedes marcar más. Al guardar se reservan para este instalador y esta salida.</p>
              {faltantesKit.length > 0 && (
                <p role="alert" className="text-[10px] text-amber-300">
                  Faltan unidades para completar el kit: {faltantesKit.join(', ')}.
                </p>
              )}
            </fieldset>

            <ListaChecklist plantilla={checklistSalida} marcados={form.marcados} onChange={(marcados) => setForm((prev) => ({ ...prev, marcados }))} idPrefijo="salida" />

            <label className="block space-y-1 text-[11px] font-semibold text-slate-300">
              Observaciones de salida
              <textarea rows="2" value={form.novedad} onChange={(event) => setForm((prev) => ({ ...prev, novedad: event.target.value }))} className={claseCampo} />
            </label>

            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={() => setModalSalida(false)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancelar</button>
              <button type="submit" disabled={guardando || !kitsInstalacion.length || !instaladores.length || !ordenes.length || !plantillas.some((item) => item.tipo === 'salida' && item.activo !== false) || !checklistCierre} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {guardando ? 'Registrando...' : 'Confirmar salida'}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalCierre && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center overflow-y-auto bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <form onSubmit={finalizarInstalacion} className="max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-5 sm:rounded-3xl">
            <div>
              <h3 className="text-base font-bold text-white">Chequeo de retorno</h3>
              <p className="mt-1 text-xs text-slate-400">
                Confirma que las herramientas del kit regresan completas para cerrar la orden de instalación.
              </p>
              <ul className="mt-3 space-y-1 rounded-xl border border-slate-800 bg-slate-950 p-3">
                {(modalCierre.herramientas || []).map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <Wrench size={12} className="text-slate-500" /> {item.nombre} · {item.codigo || 'Sin código'}
                  </li>
                ))}
              </ul>
            </div>
            {checklistCierre ? (
              <ListaChecklist plantilla={checklistCierre} marcados={marcadosCierre} onChange={setMarcadosCierre} idPrefijo="cierre" />
            ) : (
              <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                Configura un checklist de tipo Entrada en la pestaña Checklists para habilitar el cierre.
              </p>
            )}
            <label className="block space-y-1 text-[11px] font-semibold text-slate-300">
              Observaciones de retorno
              <textarea rows="2" value={novedadCierre} onChange={(event) => setNovedadCierre(event.target.value)} className={claseCampo} />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={() => setModalCierre(null)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300">Cancelar</button>
              <button type="submit" disabled={guardando || !checklistCierre} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                <CheckCircle2 size={14} /> {guardando ? 'Guardando...' : 'Confirmar retorno y cerrar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
