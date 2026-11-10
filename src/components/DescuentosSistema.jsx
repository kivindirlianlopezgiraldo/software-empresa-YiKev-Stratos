import { useMemo, useState } from 'react';
import { Calculator, Lock, Plus, Save, Trash2 } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { FORMULAS_CORTE, TIPOS_PIEZA } from '../lib/constants';
import { nuevoId } from '../lib/format';
import {
  LARGO_BARRA_DEFECTO_CM,
  configuracionFormula,
  etiquetaTipoPieza,
  formatearCm,
  generarDespiece,
} from '../lib/despiece';

import DespiecePanel from './DespiecePanel';
import Modal from './Modal';

const CLASE_INPUT =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500 disabled:opacity-40';
const CLASE_ETIQUETA = 'block text-[9px] uppercase tracking-wide text-slate-500 mb-0.5';

const numero = (valor, defecto = 0) => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : defecto;
};

// Copia el objeto sin las columnas indicadas (para bases sin la migración 008).
const sinColumnas = (datos, columnas) => {
  const copia = { ...datos };
  columnas.forEach((columna) => {
    delete copia[columna];
  });
  return copia;
};

const inferirTipoPieza = (material) => {
  const categoria = String(material?.categoria || '').toLowerCase();
  if (/vidrio|cristal|espejo/.test(categoria)) return 'vidrio';
  if (/perfil|aluminio|pvc|acrílico|acrilico/.test(categoria)) return 'perfil';
  if (/empaque|sellante|silicona/.test(categoria)) return 'empaque';
  return 'accesorio';
};

const borradorDe = (linea) => {
  const config = configuracionFormula(linea);
  return {
    cantidad: String(linea.cantidad_requerida ?? 1),
    base: config.base || linea.formula_largo || 'fijo',
    restarCm: String(config.restarCm ?? 0),
    dividir: String(config.dividir ?? 1),
    descuentoMm: String(linea.descuento_mm ?? 0),
    merma: String(linea.merma_porcentaje ?? 0),
    angulo: String(config.angulo ?? 0),
    referencia: config.referencia || '',
  };
};

const FORM_NUEVO_VACIO = {
  materialId: '',
  tipoPieza: 'perfil',
  cantidad: '1',
  base: 'ancho',
  restarCm: '0',
  descuentoMm: '0',
  dividir: '1',
  angulo: '0',
  referencia: '',
  merma: '0',
};

const construirBorradores = (lineas) => {
  const mapa = {};
  lineas.forEach((linea) => {
    mapa[linea.id] = borradorDe(linea);
  });
  return mapa;
};

export default function DescuentosSistema({
  abierto,
  sistema,
  materiales = [],
  inventario = [],
  puedeEditar = false,
  onClose,
  onRecargarMateriales,
  onSistemaActualizado,
  mostrar,
}) {
  // El componente se monta de nuevo (key en el padre) cuando cambia el sistema
  // o la lista de piezas, así el formulario siempre parte de la receta actual.
  const [borradores, setBorradores] = useState(() => construirBorradores(materiales));
  const [guardandoId, setGuardandoId] = useState(null);
  const [descuentoVidrioAncho, setDescuentoVidrioAncho] = useState(() =>
    String(sistema?.descuento_vidrio_ancho_mm ?? 30),
  );
  const [descuentoVidrioAlto, setDescuentoVidrioAlto] = useState(() =>
    String(sistema?.descuento_vidrio_alto_mm ?? 30),
  );
  const [guardandoVidrio, setGuardandoVidrio] = useState(false);
  const [anchoMuestra, setAnchoMuestra] = useState('120');
  const [altoMuestra, setAltoMuestra] = useState('100');
  const [nuevo, setNuevo] = useState(FORM_NUEVO_VACIO);
  const [agregando, setAgregando] = useState(false);

  const materialNuevo = useMemo(
    () => inventario.find((material) => material.id === nuevo.materialId) || null,
    [inventario, nuevo.materialId],
  );

  const cambiarBorrador = (id, campo, valor) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }));
  };

  const recetaConBorradores = useMemo(
    () =>
      materiales.map((linea) => {
        const borrador = borradores[linea.id];
        if (!borrador) return linea;

        const esPerfil = linea.tipo_pieza === 'perfil';
        return {
          ...linea,
          cantidad_requerida: Math.max(0.01, numero(borrador.cantidad, 1)),
          descuento_mm: Math.max(0, numero(borrador.descuentoMm, 0)),
          merma_porcentaje: Math.max(0, numero(borrador.merma, 0)),
          formula_largo: esPerfil ? borrador.base : 'fijo',
          formula_config: {
            base: esPerfil ? borrador.base : 'fijo',
            restarCm: esPerfil ? Math.max(0, numero(borrador.restarCm, 0)) : 0,
            dividir: esPerfil ? Math.max(1, numero(borrador.dividir, 1) || 1) : 1,
            referencia:
              esPerfil && borrador.base === 'referencia'
                ? String(borrador.referencia || '').trim()
                : '',
            angulo: esPerfil ? Math.max(0, numero(borrador.angulo, 0)) : 0,
          },
        };
      }),
    [materiales, borradores],
  );

  // Despiece de prueba con la receta y los descuentos que se están editando.
  const despiece = useMemo(() => {
    if (!sistema) return null;

    const sistemaPreview = {
      ...sistema,
      descuento_vidrio_ancho_mm: Math.max(0, numero(descuentoVidrioAncho, 30)),
      descuento_vidrio_alto_mm: Math.max(0, numero(descuentoVidrioAlto, 30)),
      materiales: recetaConBorradores.map((linea) => ({
        ...linea,
        material: linea.material,
        categoria: linea.material?.categoria,
      })),
    };

    return generarDespiece(
      [
        {
          id: 'muestra-descuentos',
          sistema_id: sistema.id,
          descripcion: `Muestra ${anchoMuestra || 0} × ${altoMuestra || 0} cm`,
          ancho_cm: numero(anchoMuestra),
          alto_cm: numero(altoMuestra),
          cantidad: 1,
          color: 'Blanco',
        },
      ],
      [sistemaPreview],
      {
        retales: [],
        largoBarraCm: sistema.largo_barra_cm || LARGO_BARRA_DEFECTO_CM,
      },
    );
  }, [sistema, recetaConBorradores, descuentoVidrioAncho, descuentoVidrioAlto, anchoMuestra, altoMuestra]);

  const itemPreview = despiece?.items?.[0] || null;

  const resultadoDe = (linea, indice) => {
    const tipo = linea.tipo_pieza;
    const materialId = linea.material?.id || linea.material_id;

    if (tipo === 'perfil') {
      const corte = (itemPreview?.cortes || []).find((c) => c.lineKey === `0-${indice}`);
      if (!corte) return '—';
      return `${formatearCm(corte.largoCorteCm)} · ${Number(corte.cantidad || 0)} pz`;
    }

    if (tipo === 'vidrio') {
      const vidrio = (itemPreview?.vidrios || []).find((v) => v.materialId === materialId);
      if (!vidrio) return '—';
      return `${formatearCm(vidrio.anchoMm / 10)} × ${formatearCm(vidrio.altoMm / 10)} · ${Number(
        vidrio.cantidad || 0,
      )} pz`;
    }

    const accesorio = (itemPreview?.accesorios || []).find((a) => a.materialId === materialId);
    const cantidad = accesorio?.cantidad ?? numero(borradores[linea.id]?.cantidad, 1);
    return `${cantidad} ${linea.material?.unidad_medida || ''}`.trim();
  };

  const guardarVidrio = async () => {
    if (!puedeEditar || !sistema) return;
    setGuardandoVidrio(true);
    try {
      const { error: errorUpdate } = await supabase
        .from('sistemas_trabajo')
        .update({
          descuento_vidrio_ancho_mm: Math.max(0, numero(descuentoVidrioAncho, 30)),
          descuento_vidrio_alto_mm: Math.max(0, numero(descuentoVidrioAlto, 30)),
        })
        .eq('id', sistema.id);
      if (errorUpdate) throw errorUpdate;
      mostrar?.('Descuento de vidrio guardado', 'Se aplicará a todos los vidrios del sistema.', 'exito');
      onSistemaActualizado?.({
        descuento_vidrio_ancho_mm: Math.max(0, numero(descuentoVidrioAncho, 30)),
        descuento_vidrio_alto_mm: Math.max(0, numero(descuentoVidrioAlto, 30)),
      });
    } catch (err) {
      mostrar?.('No se pudo guardar', err.message);
    } finally {
      setGuardandoVidrio(false);
    }
  };

  const guardarLinea = async (linea, indice) => {
    if (!puedeEditar || !linea?.id) return;
    const borrador = borradores[linea.id];
    if (!borrador) return;

    setGuardandoId(linea.id);
    try {
      const esPerfil = linea.tipo_pieza === 'perfil';
      const datos = {
        cantidad_requerida: Math.max(0.01, numero(borrador.cantidad, 1)),
        descuento_mm: Math.max(0, numero(borrador.descuentoMm, 0)),
        merma_porcentaje: Math.max(0, numero(borrador.merma, 0)),
        formula_largo: esPerfil ? borrador.base : 'fijo',
        formula_config: {
          base: esPerfil ? borrador.base : 'fijo',
          restarCm: esPerfil ? Math.max(0, numero(borrador.restarCm, 0)) : 0,
          dividir: esPerfil ? Math.max(1, numero(borrador.dividir, 1) || 1) : 1,
          referencia:
            esPerfil && borrador.base === 'referencia'
              ? String(borrador.referencia || '').trim()
              : '',
          angulo: esPerfil ? Math.max(0, numero(borrador.angulo, 0)) : 0,
        },
        angulo_corte: esPerfil ? Math.max(0, numero(borrador.angulo, 0)) : 0,
      };

      const actualizar = (payload) =>
        supabase.from('sistema_materiales').update(payload).eq('id', linea.id);

      let respuesta = await actualizar(datos);
      if (respuesta.error && /formula_config|angulo_corte/i.test(respuesta.error.message || '')) {
        respuesta = await actualizar(sinColumnas(datos, ['formula_config', 'angulo_corte']));
      }
      if (respuesta.error) throw respuesta.error;

      mostrar?.(
        'Descuento guardado',
        `${linea.material?.nombre || `Pieza ${indice + 1}`} actualizado.`,
        'exito',
      );
      await onRecargarMateriales?.();
    } catch (err) {
      mostrar?.('No se pudo guardar', err.message);
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarLinea = async (linea) => {
    if (!puedeEditar) return;
    const confirmado = window.confirm(
      `¿Quitar “${linea.material?.nombre || 'esta pieza'}” del sistema? También desaparecerá del despiece.`,
    );
    if (!confirmado) return;

    try {
      const { error: errorDelete } = await supabase
        .from('sistema_materiales')
        .delete()
        .eq('id', linea.id);
      if (errorDelete) throw errorDelete;
      mostrar?.('Pieza eliminada', 'La receta y el despiece se actualizaron.', 'exito');
      await onRecargarMateriales?.();
    } catch (err) {
      mostrar?.('No se pudo eliminar', err.message);
    }
  };

  const agregarLinea = async (evento) => {
    evento.preventDefault();
    if (!puedeEditar || !sistema) return;
    if (!materialNuevo) {
      mostrar?.('Selección requerida', 'Elige el material que llevará el sistema.');
      return;
    }

    setAgregando(true);
    try {
      const esPerfil = nuevo.tipoPieza === 'perfil';
      const datos = {
        cantidad_requerida: Math.max(0.01, numero(nuevo.cantidad, 1)),
        tipo_pieza: nuevo.tipoPieza,
        formula_largo: esPerfil ? nuevo.base : 'fijo',
        formula_config: {
          base: esPerfil ? nuevo.base : 'fijo',
          restarCm: esPerfil ? Math.max(0, numero(nuevo.restarCm, 0)) : 0,
          dividir: esPerfil ? Math.max(1, numero(nuevo.dividir, 1) || 1) : 1,
          referencia:
            esPerfil && nuevo.base === 'referencia' ? String(nuevo.referencia || '').trim() : '',
          angulo: esPerfil ? Math.max(0, numero(nuevo.angulo, 0)) : 0,
        },
        angulo_corte: esPerfil ? Math.max(0, numero(nuevo.angulo, 0)) : 0,
        descuento_mm: Math.max(0, numero(nuevo.descuentoMm, 0)),
        merma_porcentaje: Math.max(0, numero(nuevo.merma, 0)),
        es_vidrio: nuevo.tipoPieza === 'vidrio',
      };

      const siguienteOrden =
        materiales.reduce((maximo, linea) => Math.max(maximo, Number(linea.orden) || 0), 0) + 1;

      const insertar = (payload) =>
        supabase.from('sistema_materiales').insert([
          {
            id: nuevoId(),
            sistema_id: sistema.id,
            material_id: materialNuevo.id,
            orden: siguienteOrden,
            ...payload,
          },
        ]);

      let respuesta = await insertar(datos);
      if (respuesta.error && /formula_config|angulo_corte/i.test(respuesta.error.message || '')) {
        respuesta = await insertar(sinColumnas(datos, ['formula_config', 'angulo_corte']));
      }
      if (respuesta.error) throw respuesta.error;

      mostrar?.(
        'Pieza agregada',
        `${materialNuevo.nombre} quedó en la receta con su descuento.`,
        'exito',
      );
      setNuevo(FORM_NUEVO_VACIO);
      await onRecargarMateriales?.();
    } catch (err) {
      mostrar?.('No se pudo agregar', err.message);
    } finally {
      setAgregando(false);
    }
  };

  const elegirMaterialNuevo = (materialId) => {
    const material = inventario.find((item) => item.id === materialId) || null;
    const tipoPieza = material ? inferirTipoPieza(material) : 'perfil';
    setNuevo((prev) => ({
      ...prev,
      materialId,
      tipoPieza,
      base: tipoPieza === 'perfil' ? prev.base || 'ancho' : 'fijo',
    }));
  };

  const referenciasDisponibles = useMemo(
    () =>
      materiales
        .filter((linea) => linea.tipo_pieza === 'perfil' && linea.material?.nombre)
        .map((linea) => linea.material.nombre),
    [materiales],
  );

  return (
    <Modal
      abierto={abierto}
      onClose={onClose}
      icono={<Calculator size={20} />}
      titulo={sistema ? `Descuentos · ${sistema.nombre}` : 'Descuentos del sistema'}
      subtitulo="Crea, edita o elimina los descuentos de cada pieza y mira el despiece al instante."
      ancho="max-w-5xl"
    >
      {!puedeEditar && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <p>
            Solo el <strong>Super Admin</strong> y el <strong>Jefe de Taller</strong> pueden
            modificar los descuentos. Puedes consultar el despiece, pero no editarlo.
          </p>
        </div>
      )}

      {/* Descuento general del vidrio */}
      <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
              Descuento del vidrio
            </p>
            <p className="text-[10px] text-slate-500">
              Se resta al ancho y al alto de cada vidrio de este sistema.
            </p>
          </div>
          <button
            type="button"
            onClick={guardarVidrio}
            disabled={!puedeEditar || guardandoVidrio}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
          >
            <Save size={13} /> {guardandoVidrio ? 'Guardando…' : 'Guardar vidrio'}
          </button>
        </div>
        <div className="grid max-w-md grid-cols-2 gap-2">
          <div>
            <label htmlFor="desc-vidrio-ancho" className={CLASE_ETIQUETA}>
              Ancho (mm)
            </label>
            <input
              id="desc-vidrio-ancho"
              type="number"
              min="0"
              step="0.1"
              value={descuentoVidrioAncho}
              onChange={(evento) => setDescuentoVidrioAncho(evento.target.value)}
              disabled={!puedeEditar}
              className={CLASE_INPUT}
            />
          </div>
          <div>
            <label htmlFor="desc-vidrio-alto" className={CLASE_ETIQUETA}>
              Alto (mm)
            </label>
            <input
              id="desc-vidrio-alto"
              type="number"
              min="0"
              step="0.1"
              value={descuentoVidrioAlto}
              onChange={(evento) => setDescuentoVidrioAlto(evento.target.value)}
              disabled={!puedeEditar}
              className={CLASE_INPUT}
            />
          </div>
        </div>
      </section>

      {/* Medidas de la muestra */}
      <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
          Medidas de la muestra
        </p>
        <p className="text-[10px] text-slate-500">
          Con estas medidas se calculan los cortes y las cantidades que aparecen abajo. No
          modifican ninguna orden.
        </p>
        <div className="grid max-w-md grid-cols-2 gap-2">
          <div>
            <label htmlFor="muestra-ancho" className={CLASE_ETIQUETA}>
              Ancho del vano (cm)
            </label>
            <input
              id="muestra-ancho"
              type="number"
              min="1"
              step="0.1"
              value={anchoMuestra}
              onChange={(evento) => setAnchoMuestra(evento.target.value)}
              className={CLASE_INPUT}
            />
          </div>
          <div>
            <label htmlFor="muestra-alto" className={CLASE_ETIQUETA}>
              Alto del vano (cm)
            </label>
            <input
              id="muestra-alto"
              type="number"
              min="1"
              step="0.1"
              value={altoMuestra}
              onChange={(evento) => setAltoMuestra(evento.target.value)}
              className={CLASE_INPUT}
            />
          </div>
        </div>
      </section>

      {/* Descuentos por pieza */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
              Descuentos por pieza
            </p>
            <p className="text-[10px] text-slate-500">
              Fórmula: (base − restar cm − descuento mm/10) ÷ dividir. El ángulo se usa para
              cortes a inglete.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {materiales.length} pieza{materiales.length === 1 ? '' : 's'}
          </span>
        </div>

        {materiales.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
            Este sistema todavía no tiene piezas. Agrega abajo los perfiles, vidrios y accesorios
            que lleva.
          </p>
        ) : (
          <div className="space-y-2">
            {materiales.map((linea, indice) => {
              const borrador = borradores[linea.id] || borradorDe(linea);
              const esPerfil = linea.tipo_pieza === 'perfil';
              const resultado = resultadoDe(linea, indice);

              return (
                <div
                  key={linea.id}
                  className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        {linea.material?.nombre || 'Material eliminado'}
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        Ref: {linea.material?.codigo_referencia || 'N/A'} ·{' '}
                        {etiquetaTipoPieza(linea.tipo_pieza)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">
                        Resultado en la muestra
                      </p>
                      <p className="font-mono text-xs font-black text-cyan-400">{resultado}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
                    <div>
                      <label className={CLASE_ETIQUETA} htmlFor={`cantidad-${linea.id}`}>
                        Piezas
                      </label>
                      <input
                        id={`cantidad-${linea.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={borrador.cantidad}
                        onChange={(evento) =>
                          cambiarBorrador(linea.id, 'cantidad', evento.target.value)
                        }
                        disabled={!puedeEditar}
                        className={CLASE_INPUT}
                      />
                    </div>

                    {esPerfil && (
                      <>
                        <div>
                          <label className={CLASE_ETIQUETA} htmlFor={`base-${linea.id}`}>
                            Base
                          </label>
                          <select
                            id={`base-${linea.id}`}
                            value={borrador.base}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'base', evento.target.value)
                            }
                            disabled={!puedeEditar}
                            className={CLASE_INPUT}
                          >
                            {FORMULAS_CORTE.map((formula) => (
                              <option key={formula.valor} value={formula.valor}>
                                {formula.etiqueta}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={CLASE_ETIQUETA} htmlFor={`restar-${linea.id}`}>
                            Restar (cm)
                          </label>
                          <input
                            id={`restar-${linea.id}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={borrador.restarCm}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'restarCm', evento.target.value)
                            }
                            disabled={!puedeEditar}
                            className={CLASE_INPUT}
                          />
                        </div>
                        <div>
                          <label className={CLASE_ETIQUETA} htmlFor={`dividir-${linea.id}`}>
                            Dividir entre
                          </label>
                          <input
                            id={`dividir-${linea.id}`}
                            type="number"
                            min="1"
                            step="1"
                            value={borrador.dividir}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'dividir', evento.target.value)
                            }
                            disabled={!puedeEditar}
                            className={CLASE_INPUT}
                          />
                        </div>
                        <div>
                          <label className={CLASE_ETIQUETA} htmlFor={`angulo-${linea.id}`}>
                            Ángulo (°)
                          </label>
                          <input
                            id={`angulo-${linea.id}`}
                            type="number"
                            min="0"
                            step="0.1"
                            value={borrador.angulo}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'angulo', evento.target.value)
                            }
                            disabled={!puedeEditar}
                            className={CLASE_INPUT}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className={CLASE_ETIQUETA} htmlFor={`referencia-${linea.id}`}>
                            Pieza de referencia
                          </label>
                          <select
                            id={`referencia-${linea.id}`}
                            value={borrador.referencia}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'referencia', evento.target.value)
                            }
                            disabled={!puedeEditar || borrador.base !== 'referencia'}
                            className={CLASE_INPUT}
                          >
                            <option value="">Sin referencia</option>
                            {referenciasDisponibles
                              .filter((nombre) => nombre !== linea.material?.nombre)
                              .map((nombre) => (
                                <option key={nombre} value={nombre}>
                                  {nombre}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div>
                      <label className={CLASE_ETIQUETA} htmlFor={`descuento-${linea.id}`}>
                        Descuento (mm)
                      </label>
                      <input
                        id={`descuento-${linea.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={borrador.descuentoMm}
                        onChange={(evento) =>
                          cambiarBorrador(linea.id, 'descuentoMm', evento.target.value)
                        }
                        disabled={!puedeEditar}
                        className={CLASE_INPUT}
                      />
                    </div>
                    <div>
                      <label className={CLASE_ETIQUETA} htmlFor={`merma-${linea.id}`}>
                        Merma (%)
                      </label>
                      <input
                        id={`merma-${linea.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={borrador.merma}
                        onChange={(evento) =>
                          cambiarBorrador(linea.id, 'merma', evento.target.value)
                        }
                        disabled={!puedeEditar}
                        className={CLASE_INPUT}
                      />
                    </div>
                  </div>

                  {!esPerfil && (
                    <p className="text-[10px] text-slate-500">
                      {linea.tipo_pieza === 'vidrio'
                        ? 'El corte del vidrio usa el descuento general de vidrio de arriba; aquí ajustas la cantidad de piezas.'
                        : 'Este material no se corta: solo se descuenta del inventario en la cantidad indicada.'}
                    </p>
                  )}

                  {puedeEditar && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => guardarLinea(linea, indice)}
                        disabled={guardandoId === linea.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                      >
                        <Save size={13} />
                        {guardandoId === linea.id ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarLinea(linea)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 size={13} /> Quitar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Agregar pieza con descuento */}
      {puedeEditar && (
        <section className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Agregar pieza al sistema
          </p>
          <p className="text-[10px] text-slate-500">
            Elige un perfil, vidrio, accesorio o empaque del inventario y define cuántas piezas
            lleva y cómo se descuenta al cortar.
          </p>

          <form onSubmit={agregarLinea} className="space-y-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="col-span-2">
                <label className={CLASE_ETIQUETA} htmlFor="nuevo-material">
                  Material del inventario
                </label>
                <select
                  id="nuevo-material"
                  value={nuevo.materialId}
                  onChange={(evento) => elegirMaterialNuevo(evento.target.value)}
                  className={CLASE_INPUT}
                >
                  <option value="">Selecciona un material…</option>
                  {inventario.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.nombre} · {material.unidad_medida}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={CLASE_ETIQUETA} htmlFor="nuevo-tipo">
                  Tipo de pieza
                </label>
                <select
                  id="nuevo-tipo"
                  value={nuevo.tipoPieza}
                  onChange={(evento) =>
                    setNuevo((prev) => ({
                      ...prev,
                      tipoPieza: evento.target.value,
                      base: evento.target.value === 'perfil' ? prev.base || 'ancho' : 'fijo',
                    }))
                  }
                  className={CLASE_INPUT}
                >
                  {TIPOS_PIEZA.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={CLASE_ETIQUETA} htmlFor="nuevo-cantidad">
                  Cantidad
                </label>
                <input
                  id="nuevo-cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={nuevo.cantidad}
                  onChange={(evento) =>
                    setNuevo((prev) => ({ ...prev, cantidad: evento.target.value }))
                  }
                  className={CLASE_INPUT}
                />
              </div>
            </div>

            {nuevo.tipoPieza === 'perfil' && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor="nuevo-base">
                    Base
                  </label>
                  <select
                    id="nuevo-base"
                    value={nuevo.base}
                    onChange={(evento) =>
                      setNuevo((prev) => ({ ...prev, base: evento.target.value }))
                    }
                    className={CLASE_INPUT}
                  >
                    {FORMULAS_CORTE.map((formula) => (
                      <option key={formula.valor} value={formula.valor}>
                        {formula.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor="nuevo-restar">
                    Restar (cm)
                  </label>
                  <input
                    id="nuevo-restar"
                    type="number"
                    min="0"
                    step="0.1"
                    value={nuevo.restarCm}
                    onChange={(evento) =>
                      setNuevo((prev) => ({ ...prev, restarCm: evento.target.value }))
                    }
                    className={CLASE_INPUT}
                  />
                </div>
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor="nuevo-dividir">
                    Dividir entre
                  </label>
                  <input
                    id="nuevo-dividir"
                    type="number"
                    min="1"
                    step="1"
                    value={nuevo.dividir}
                    onChange={(evento) =>
                      setNuevo((prev) => ({ ...prev, dividir: evento.target.value }))
                    }
                    className={CLASE_INPUT}
                  />
                </div>
                <div>
                  <label className={CLASE_ETIQUETA} htmlFor="nuevo-angulo">
                    Ángulo (°)
                  </label>
                  <input
                    id="nuevo-angulo"
                    type="number"
                    min="0"
                    step="0.1"
                    value={nuevo.angulo}
                    onChange={(evento) =>
                      setNuevo((prev) => ({ ...prev, angulo: evento.target.value }))
                    }
                    className={CLASE_INPUT}
                  />
                </div>
                <div className="col-span-2">
                  <label className={CLASE_ETIQUETA} htmlFor="nuevo-referencia">
                    Pieza de referencia
                  </label>
                  <select
                    id="nuevo-referencia"
                    value={nuevo.referencia}
                    onChange={(evento) =>
                      setNuevo((prev) => ({ ...prev, referencia: evento.target.value }))
                    }
                    disabled={nuevo.base !== 'referencia'}
                    className={CLASE_INPUT}
                  >
                    <option value="">Sin referencia</option>
                    {referenciasDisponibles.map((nombre) => (
                      <option key={nombre} value={nombre}>
                        {nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className={CLASE_ETIQUETA} htmlFor="nuevo-descuento">
                  Descuento (mm)
                </label>
                <input
                  id="nuevo-descuento"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nuevo.descuentoMm}
                  onChange={(evento) =>
                    setNuevo((prev) => ({ ...prev, descuentoMm: evento.target.value }))
                  }
                  className={CLASE_INPUT}
                />
              </div>
              <div>
                <label className={CLASE_ETIQUETA} htmlFor="nuevo-merma">
                  Merma (%)
                </label>
                <input
                  id="nuevo-merma"
                  type="number"
                  min="0"
                  step="0.1"
                  value={nuevo.merma}
                  onChange={(evento) => setNuevo((prev) => ({ ...prev, merma: evento.target.value }))}
                  className={CLASE_INPUT}
                />
              </div>
              <div className="col-span-2 flex items-end justify-end">
                <button
                  type="submit"
                  disabled={agregando || !nuevo.materialId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-[11px] font-bold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
                >
                  <Plus size={14} /> {agregando ? 'Agregando…' : 'Agregar a la receta'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Despiece resultante */}
      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
          Despiece resultante
        </p>
        <DespiecePanel
          despiece={despiece}
          titulo={`Materiales y cortes · muestra ${anchoMuestra || 0} × ${altoMuestra || 0} cm`}
          compacto
        />
      </section>
    </Modal>
  );
}
