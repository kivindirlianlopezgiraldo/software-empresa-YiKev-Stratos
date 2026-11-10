import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calculator, LoaderCircle, Ruler } from 'lucide-react';

import DespiecePanel from '../components/DespiecePanel';
import { supabase } from '../lib/supabase';
import { generarDespiece } from '../lib/despiece';

const CLASE_INPUT =
  'w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60';

export default function DespieceCalculadora({ permisos }) {
  const [sistemas, setSistemas] = useState([]);
  const [sistemaId, setSistemaId] = useState('');
  const [materiales, setMateriales] = useState([]);
  const [ancho, setAncho] = useState('');
  const [alto, setAlto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [color, setColor] = useState('');
  const [cargandoSistemas, setCargandoSistemas] = useState(true);
  const [recetaCargadaPara, setRecetaCargadaPara] = useState('');
  const [error, setError] = useState('');
  const [avisoFormulaAvanzadaPara, setAvisoFormulaAvanzadaPara] = useState('');

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const { data, error: errorConsulta } = await supabase
          .from('sistemas_trabajo')
          .select(
            'id, nombre, linea, tipo, descripcion, largo_barra_cm, descuento_vidrio_ancho_mm, descuento_vidrio_alto_mm, merma_porcentaje',
          )
          .order('nombre', { ascending: true });

        if (errorConsulta) throw errorConsulta;
        if (!activo) return;
        const filas = data ?? [];
        setSistemas(filas);
        setSistemaId(filas[0]?.id || '');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar los sistemas.');
      } finally {
        if (activo) setCargandoSistemas(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!sistemaId) return undefined;

    let activo = true;

    (async () => {
      try {
        const seleccionarReceta = (avanzada) =>
          supabase
            .from('sistema_materiales')
            .select(
              `id, cantidad_requerida, tipo_pieza, formula_largo, ${
                avanzada ? 'formula_config, angulo_corte,' : ''
              } descuento_mm, merma_porcentaje, es_vidrio, orden,
              material:material_id (id, nombre, codigo_referencia, unidad_medida, precio_venta, categoria)`,
            )
            .eq('sistema_id', sistemaId)
            .order('orden', { ascending: true });

        let { data, error: errorConsulta } = await seleccionarReceta(true);
        let usaRespaldo = false;
        if (errorConsulta && /formula_config|angulo_corte/i.test(errorConsulta.message || '')) {
          usaRespaldo = true;
          const respaldo = await seleccionarReceta(false);
          data = respaldo.data;
          errorConsulta = respaldo.error;
        }
        if (errorConsulta) throw errorConsulta;
        if (activo) {
          setMateriales(data ?? []);
          setError('');
          setAvisoFormulaAvanzadaPara(usaRespaldo ? sistemaId : '');
          setRecetaCargadaPara(sistemaId);
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudo cargar la receta del sistema.');
          setMateriales([]);
          setAvisoFormulaAvanzadaPara('');
          setRecetaCargadaPara(sistemaId);
        }
      }
    })();

    return () => {
      activo = false;
    };
  }, [sistemaId]);

  const sistemaSeleccionado = sistemas.find((sistema) => sistema.id === sistemaId);
  const cargandoReceta = Boolean(sistemaId && recetaCargadaPara !== sistemaId);
  const avisoFormulaAvanzada = avisoFormulaAvanzadaPara === sistemaId;
  const anchoCm = Number(String(ancho).replace(',', '.'));
  const altoCm = Number(String(alto).replace(',', '.'));
  const cantidadUnidades = Number(cantidad);
  const medidaValida =
    Number.isFinite(anchoCm) &&
    anchoCm > 0 &&
    Number.isFinite(altoCm) &&
    altoCm > 0 &&
    Number.isInteger(cantidadUnidades) &&
    cantidadUnidades > 0;

  const despiece = useMemo(() => {
    if (!sistemaSeleccionado || !materiales.length || !medidaValida || cargandoReceta) {
      return null;
    }

    const sistema = { ...sistemaSeleccionado, materiales };
    return generarDespiece(
      [
        {
          id: 'calculadora-despiece',
          sistema_id: sistema.id,
          descripcion: sistema.nombre,
          ancho_cm: anchoCm,
          alto_cm: altoCm,
          cantidad: cantidadUnidades,
          color: color.trim() || 'Sin definir',
        },
      ],
      [sistema],
    );
  }, [
    sistemaSeleccionado,
    materiales,
    medidaValida,
    cargandoReceta,
    anchoCm,
    altoCm,
    cantidadUnidades,
    color,
  ]);

  if (!permisos?.puedeCalcularDespiece) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-500/30 bg-red-950/30 p-5 text-sm text-red-200"
      >
        No tienes permiso para acceder a la calculadora de despiece.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-cyan-300">
          <Calculator size={19} aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            Herramienta de producción
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-black text-white">Calculadora de Despiece</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
          Selecciona un sistema e ingresa las medidas. Se aplican las fórmulas, descuentos,
          cantidades y accesorios configurados en su receta. Este cálculo no crea ni modifica una
          orden.
        </p>
      </header>

      <section
        aria-labelledby="datos-calculo-titulo"
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5"
      >
        <div className="flex items-center gap-2">
          <Ruler size={17} className="text-cyan-300" aria-hidden="true" />
          <h2 id="datos-calculo-titulo" className="text-sm font-bold text-white">
            Medidas de fabricación
          </h2>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {avisoFormulaAvanzada && (
          <div
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200"
          >
            La migración 008 no está aplicada. El sistema se calculó con las fórmulas básicas
            disponibles; aplica la migración para usar descuentos avanzados, divisores y ángulos.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-2">
            <label
              htmlFor="calculadora-sistema"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Sistema de trabajo
            </label>
            <select
              id="calculadora-sistema"
              value={sistemaId}
              onChange={(evento) => {
                setError('');
                setSistemaId(evento.target.value);
              }}
              className={CLASE_INPUT}
              disabled={cargandoSistemas || sistemas.length === 0}
            >
              {sistemas.length === 0 && <option value="">No hay sistemas configurados</option>}
              {sistemas.map((sistema) => (
                <option key={sistema.id} value={sistema.id}>
                  {sistema.nombre} · {sistema.linea || 'Sin línea'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="calculadora-ancho" className="mb-1 block text-xs font-semibold text-slate-300">
              Ancho (cm)
            </label>
            <input
              id="calculadora-ancho"
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={ancho}
              onChange={(evento) => setAncho(evento.target.value)}
              placeholder="Ej. 120"
              className={CLASE_INPUT}
            />
          </div>

          <div>
            <label htmlFor="calculadora-alto" className="mb-1 block text-xs font-semibold text-slate-300">
              Alto (cm)
            </label>
            <input
              id="calculadora-alto"
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={alto}
              onChange={(evento) => setAlto(evento.target.value)}
              placeholder="Ej. 100"
              className={CLASE_INPUT}
            />
          </div>

          <div>
            <label
              htmlFor="calculadora-cantidad"
              className="mb-1 block text-xs font-semibold text-slate-300"
            >
              Cantidad de unidades
            </label>
            <input
              id="calculadora-cantidad"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
              className={CLASE_INPUT}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <label htmlFor="calculadora-color" className="mb-1 block text-xs font-semibold text-slate-300">
              Color / acabado del perfil (opcional)
            </label>
            <input
              id="calculadora-color"
              type="text"
              value={color}
              onChange={(evento) => setColor(evento.target.value)}
              placeholder="Ej. Negro"
              className={CLASE_INPUT}
            />
          </div>
        </div>

        {sistemaSeleccionado?.descripcion && (
          <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs leading-relaxed text-slate-300">
            {sistemaSeleccionado.descripcion}
          </p>
        )}
      </section>

      {cargandoSistemas || cargandoReceta ? (
        <div role="status" className="flex items-center gap-2 rounded-2xl bg-slate-900 p-5 text-sm text-slate-300">
          <LoaderCircle size={17} className="animate-spin" aria-hidden="true" />
          Cargando receta del sistema...
        </div>
      ) : !sistemaId ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-300">
          Primero configura un sistema y agrega sus perfiles, vidrios y accesorios en Sistemas y
          Recetas.
        </div>
      ) : materiales.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-950/20 p-5 text-sm text-amber-200">
          Este sistema todavía no tiene una receta de materiales configurada.
        </div>
      ) : !medidaValida ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-300">
          Ingresa un ancho y alto mayores que cero, y una cantidad entera de unidades para ver los
          cortes y materiales.
        </div>
      ) : despiece ? (
        <DespiecePanel despiece={despiece} titulo="Despiece calculado" compacto />
      ) : null}
    </div>
  );
}
