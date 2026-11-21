import { useMemo, useState } from 'react';
import { AlertCircle, Calculator, Lock, Save, Trash2 } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { FORMULAS_CORTE } from '../lib/constants';
import {
  LARGO_BARRA_DEFECTO_CM,
  configuracionFormula,
  etiquetaTipoPieza,
  formatearCm,
  generarDespiece,
} from '../lib/despiece';

import DespiecePanel from './DespiecePanel';
import Modal from './Modal';
import useConfirm from '../hooks/useConfirm';

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

const borradorDe = (linea) => {
  const config = configuracionFormula(linea);
  return {
    base: config.base || linea.formula_largo || 'fijo',
    restarCm: String(config.restarCm ?? 0),
    dividir: String(config.dividir ?? 1),
    descuentoMm: String(linea.descuento_mm ?? 0),
    merma: String(linea.merma_porcentaje ?? 0),
    angulo: String(config.angulo ?? 0),
    ladoAngulo: config.ladoAngulo || '',
    referencia: config.referencia || '',
    descuentosAdicionalesMm: config.descuentosAdicionalesMm.map(String),
  };
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
  puedeEditar = false,
  soportaAvanzado = true,
  onClose,
  onOpenMaterials,
  onRecargarMateriales,
  onSistemaActualizado,
  mostrar,
}) {
  const confirmar = useConfirm();
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
  const [descuentoPerfilAncho, setDescuentoPerfilAncho] = useState(() =>
    String(sistema?.descuento_perfil_ancho_mm ?? 0),
  );
  const [descuentoPerfilAlto, setDescuentoPerfilAlto] = useState(() =>
    String(sistema?.descuento_perfil_alto_mm ?? 0),
  );
  const [largoBarra, setLargoBarra] = useState(() =>
    String(sistema?.largo_barra_cm ?? LARGO_BARRA_DEFECTO_CM),
  );
  const [mermaGeneral, setMermaGeneral] = useState(() =>
    String(sistema?.merma_porcentaje ?? 5),
  );
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  const [anchoMuestra, setAnchoMuestra] = useState('120');
  const [altoMuestra, setAltoMuestra] = useState('100');

  const cambiarBorrador = (id, campo, valor) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }));
  };

  const cambiarDescuentoAdicional = (id, indice, valor) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        descuentosAdicionalesMm: prev[id].descuentosAdicionalesMm.map((descuento, i) =>
          i === indice ? valor : descuento,
        ),
      },
    }));
  };

  const agregarDescuentoAdicional = (id) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        descuentosAdicionalesMm: [...prev[id].descuentosAdicionalesMm, '0'],
      },
    }));
  };

  const quitarDescuentoAdicional = (id, indice) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        descuentosAdicionalesMm: prev[id].descuentosAdicionalesMm.filter((_, i) => i !== indice),
      },
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
            ladoAngulo:
              esPerfil && numero(borrador.angulo, 0) > 0 ? borrador.ladoAngulo || '' : '',
            descuentosAdicionalesMm: esPerfil
              ? borrador.descuentosAdicionalesMm.map((descuento) =>
                  Math.max(0, numero(descuento, 0)),
                )
              : [],
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
      descuento_perfil_ancho_mm: Math.max(0, numero(descuentoPerfilAncho, 0)),
      descuento_perfil_alto_mm: Math.max(0, numero(descuentoPerfilAlto, 0)),
      largo_barra_cm: Math.max(1, numero(largoBarra, LARGO_BARRA_DEFECTO_CM)),
      merma_porcentaje: Math.max(0, numero(mermaGeneral, 5)),
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
        largoBarraCm: Math.max(1, numero(largoBarra, LARGO_BARRA_DEFECTO_CM)),
      },
    );
  }, [
    sistema,
    recetaConBorradores,
    descuentoVidrioAncho,
    descuentoVidrioAlto,
    descuentoPerfilAncho,
    descuentoPerfilAlto,
    largoBarra,
    mermaGeneral,
    anchoMuestra,
    altoMuestra,
  ]);

  const itemPreview = despiece?.items?.[0] || null;

  const resultadoDe = (linea, indice) => {
    const tipo = linea.tipo_pieza;
    const materialId = linea.material?.id || linea.material_id || linea.id;

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
    const cantidad = accesorio?.cantidad ?? numero(linea.cantidad_requerida, 1);
    const unidad =
      linea.material?.unidad_medida ||
      (tipo === 'perfil'
        ? 'Metro lineal (m)'
        : tipo === 'vidrio'
          ? 'Metro cuadrado (m²)'
          : 'Unidad');
    return `${cantidad} ${unidad}`.trim();
  };

  const guardarConfiguracion = async () => {
    if (!puedeEditar || !sistema) return;
    const cambios = {
      descuento_vidrio_ancho_mm: Math.max(0, numero(descuentoVidrioAncho, 30)),
      descuento_vidrio_alto_mm: Math.max(0, numero(descuentoVidrioAlto, 30)),
      descuento_perfil_ancho_mm: Math.max(0, numero(descuentoPerfilAncho, 0)),
      descuento_perfil_alto_mm: Math.max(0, numero(descuentoPerfilAlto, 0)),
      largo_barra_cm: Math.max(1, numero(largoBarra, LARGO_BARRA_DEFECTO_CM)),
      merma_porcentaje: Math.max(0, numero(mermaGeneral, 5)),
    };
    setGuardandoConfiguracion(true);
    try {
      const actualizar = (datos) =>
        supabase
          .from('sistemas_trabajo')
          .update(datos)
          .eq('id', sistema.id);
      let respuesta = await actualizar(cambios);
      if (respuesta.error && /largo_barra_cm/i.test(respuesta.error.message || '')) {
        respuesta = await actualizar(sinColumnas(cambios, ['largo_barra_cm']));
        if (!respuesta.error) {
          mostrar?.(
            'Guardado parcial',
            'Se guardaron los descuentos, pero el largo de barra requiere aplicar la migración 008 en Supabase.',
            'error',
          );
          onSistemaActualizado?.(sinColumnas(cambios, ['largo_barra_cm']));
          return;
        }
      }
      if (respuesta.error) throw respuesta.error;
      mostrar?.('Configuración guardada', 'Los descuentos y la fabricación se actualizaron.', 'exito');
      onSistemaActualizado?.(cambios);
    } catch (err) {
      mostrar?.('No se pudo guardar', err.message);
    } finally {
      setGuardandoConfiguracion(false);
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
        descuento_mm: 0,
        merma_porcentaje: 0,
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
          ladoAngulo:
            esPerfil && numero(borrador.angulo, 0) > 0 ? borrador.ladoAngulo || '' : '',
          descuentosAdicionalesMm: [],
        },
        angulo_corte: esPerfil ? Math.max(0, numero(borrador.angulo, 0)) : 0,
      };

      const actualizar = (payload) =>
        supabase.from('sistema_materiales').update(payload).eq('id', linea.id);

      let respuesta = await actualizar(datos);
      let usoRespaldo = false;
      if (respuesta.error && /formula_config|angulo_corte/i.test(respuesta.error.message || '')) {
        usoRespaldo = true;
        respuesta = await actualizar(sinColumnas(datos, ['formula_config', 'angulo_corte']));
      }
      if (respuesta.error) throw respuesta.error;

      const usaAvanzado =
        esPerfil &&
        (numero(borrador.restarCm, 0) > 0 ||
          numero(borrador.dividir, 1) > 1 ||
          numero(borrador.angulo, 0) > 0 ||
          borrador.descuentosAdicionalesMm.some((descuento) => numero(descuento, 0) > 0) ||
          (borrador.base === 'referencia' && Boolean(String(borrador.referencia || '').trim())));

      if (usoRespaldo && usaAvanzado) {
        mostrar?.(
          'Guardado parcial',
          'Se guardaron cantidad, base, descuento y merma. Para guardar restar cm, dividir, ángulo y referencia aplica la migración 008 en Supabase.',
          'error',
        );
      } else {
        mostrar?.(
          'Descuento guardado',
          `${linea.material?.nombre || linea.material_nombre || `Pieza ${indice + 1}`} actualizado.`,
          'exito',
        );
      }
      await onRecargarMateriales?.();
    } catch (err) {
      mostrar?.('No se pudo guardar', err.message);
    } finally {
      setGuardandoId(null);
    }
  };

  const eliminarLinea = async (linea) => {
    if (!puedeEditar) return;
    const confirmado = await confirmar({
      titulo: 'Quitar material del sistema',
      mensaje: `¿Quitar “${linea.material?.nombre || linea.material_nombre || 'esta pieza'}” del sistema? También desaparecerá del despiece.`,
      confirmarTexto: 'Quitar material',
    });
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

  const referenciasDisponibles = useMemo(
    () =>
      materiales
        .filter(
          (linea) =>
            linea.tipo_pieza === 'perfil' &&
            (linea.material?.nombre || linea.material_nombre),
        )
        .map((linea) => linea.material?.nombre || linea.material_nombre),
    [materiales],
  );

  return (
    <Modal
      abierto={abierto}
      onClose={onClose}
      icono={<Calculator size={20} />}
      titulo={sistema ? `Fórmulas y descuentos · ${sistema.nombre}` : 'Fórmulas del sistema'}
      subtitulo="Gestiona la fórmula de corte de cada perfil, los descuentos y el despiece en tiempo real."
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

      {!soportaAvanzado && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>
            <strong>Migración 008 pendiente:</strong> cantidad, base, descuento y merma sí se
            guardan. Para guardar <strong>restar cm, dividir, ángulo y referencia</strong> hay que
            ejecutar la migración 008 en Supabase.
          </p>
        </div>
      )}

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
              Fórmulas por perfil
            </p>
            <p className="text-[10px] text-slate-500">
              Fórmula: (medida base − restar cm) ÷ dividir. Configura cada perfil según el
              sistema.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {materiales.length} pieza{materiales.length === 1 ? '' : 's'}
          </span>
        </div>

        {materiales.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
            Este sistema todavía no tiene materiales. Agrégalos desde el panel de materiales para
            luego configurar aquí sus descuentos y fórmulas.
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
                        {linea.material?.nombre || linea.material_nombre || 'Material eliminado'}
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

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
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
                        <div>
                          <label className={CLASE_ETIQUETA} htmlFor={`lado-angulo-${linea.id}`}>
                            Extremo del ángulo
                          </label>
                          <select
                            id={`lado-angulo-${linea.id}`}
                            value={borrador.ladoAngulo}
                            onChange={(evento) =>
                              cambiarBorrador(linea.id, 'ladoAngulo', evento.target.value)
                            }
                            disabled={!puedeEditar || numero(borrador.angulo, 0) <= 0}
                            className={CLASE_INPUT}
                          >
                            <option value="">Sin especificar</option>
                            <option value="sillar">Lado del sillar</option>
                            <option value="cabezal">Lado del cabezal</option>
                          </select>
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
                              .filter(
                                (nombre) =>
                                  nombre !== (linea.material?.nombre || linea.material_nombre),
                              )
                              .map((nombre) => (
                                <option key={nombre} value={nombre}>
                                  {nombre}
                                </option>
                              ))}
                          </select>
                        </div>
                      </>
                    )}

                  </div>

                  {!esPerfil && (
                    <p className="text-[10px] text-slate-500">
                      {linea.tipo_pieza === 'vidrio'
                        ? 'Se calcula el área del vidrio y las piezas indicadas.'
                        : 'Este material no es un perfil de corte.'}
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

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <p className="text-[10px] text-slate-400">
          Para agregar o quitar perfiles, vidrios, accesorios y empaques, usa el panel de materiales.
        </p>
        <button
          type="button"
          onClick={onOpenMaterials}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-blue-500"
        >
          Gestionar materiales y cantidades
        </button>
      </section>
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
