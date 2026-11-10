import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calculator,
  Edit2,
  Layers,
  Lock,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  FORMULAS_CORTE,
  LINEAS_SISTEMA,
  TIPOS_PIEZA,
  TIPOS_SISTEMA,
} from '../lib/constants';
import { formatCOP, nuevoId } from '../lib/format';
import {
  LARGO_BARRA_DEFECTO_CM,
  configuracionFormula,
  describirFormula,
  etiquetaTipoPieza,
  generarDespiece,
} from '../lib/despiece';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import DespiecePanel from '../components/DespiecePanel';
import DescuentosSistema from '../components/DescuentosSistema';
import useToast from '../hooks/useToast';

// Copia el objeto sin las columnas indicadas (para bases sin la migración 008).
const sinColumnas = (datos, columnas) => {
  const copia = { ...datos };
  columnas.forEach((columna) => {
    delete copia[columna];
  });
  return copia;
};

const FORM_SISTEMA_VACIO = {
  nombre: '',
  linea: LINEAS_SISTEMA[0],
  tipo: 'corrediza',
  descripcion: '',
  largoBarra: String(LARGO_BARRA_DEFECTO_CM),
  descuentoVidrioAncho: '30',
  descuentoVidrioAlto: '30',
  descuentoPerfilAncho: '0',
  descuentoPerfilAlto: '0',
  merma: '5',
};

const FORM_MATERIAL_VACIO = {  cantidad: '1',
  tipoPieza: 'perfil',
  formula: 'perimetro',
  descuento: '0',
  merma: '0',
  restarCm: '0',
  dividir: '1',
  referencia: '',
  angulo: '0',
};

export default function SistemasTrabajo({ permisos }) {
  const [sistemas, setSistemas] = useState([]);
  const [inventario, setInventario] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');

  const [modalSistema, setModalSistema] = useState(false);
  const [sistemaEditando, setSistemaEditando] = useState(null);
  const [form, setForm] = useState(FORM_SISTEMA_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [modalMateriales, setModalMateriales] = useState(false);
  const [sistemaSeleccionado, setSistemaSeleccionado] = useState(null);
  const [materialesDelSistema, setMaterialesDelSistema] = useState([]);
  const [cargandoMateriales, setCargandoMateriales] = useState(false);

  const [modalDescuentos, setModalDescuentos] = useState(false);
  const [sistemaDescuentos, setSistemaDescuentos] = useState(null);
  const [soportaDespieceAvanzado, setSoportaDespieceAvanzado] = useState(true);

  const [textoBusquedaMaterial, setTextoBusquedaMaterial] = useState('');
  const [materialSeleccionado, setMaterialSeleccionado] = useState(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cantidadRequerida, setCantidadRequerida] = useState('1');
  const [tipoPieza, setTipoPieza] = useState(FORM_MATERIAL_VACIO.tipoPieza);
  const [formulaLargo, setFormulaLargo] = useState(FORM_MATERIAL_VACIO.formula);
  const [descuentoMm, setDescuentoMm] = useState(FORM_MATERIAL_VACIO.descuento);
  const [mermaLinea, setMermaLinea] = useState(FORM_MATERIAL_VACIO.merma);
  const [restarCm, setRestarCm] = useState(FORM_MATERIAL_VACIO.restarCm);
  const [dividir, setDividir] = useState(FORM_MATERIAL_VACIO.dividir);
  const [referencia, setReferencia] = useState(FORM_MATERIAL_VACIO.referencia);
  const [angulo, setAngulo] = useState(FORM_MATERIAL_VACIO.angulo);
  const [lineaEditando, setLineaEditando] = useState(null);
  const [verPreview, setVerPreview] = useState(false);
  const [agregandoMaterial, setAgregandoMaterial] = useState(false);

  const contenedorSugerencias = useRef(null);
  const { alerta, mostrar, cerrar } = useToast();

  const puedeEditar = permisos ? permisos.puedeEditarSistemas : false;

  // Conserva las líneas que ya existen en la base aunque no estén en el catálogo,
  // para no cambiarlas en silencio al editar un sistema.
  const opcionesLinea = useMemo(() => {
    const valores = new Set(LINEAS_SISTEMA);
    sistemas.forEach((sistema) => {
      if (sistema.linea) valores.add(sistema.linea);
    });
    if (form.linea) valores.add(form.linea);
    return [...valores];
  }, [sistemas, form.linea]);

  const consultarDatos = useCallback(async () => {
    const [resSistemas, resInventario] = await Promise.all([
      supabase.from('sistemas_trabajo').select('*').order('nombre', { ascending: true }),
      supabase.from('inventario_materiales').select('*').order('nombre', { ascending: true }),
    ]);

    if (resSistemas.error) throw resSistemas.error;
    if (resInventario.error) throw resInventario.error;

    return {
      sistemas: resSistemas.data ?? [],
      inventario: resInventario.data ?? [],
    };
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const resultado = await consultarDatos();
        if (!activo) return;
        setSistemas(resultado.sistemas);
        setInventario(resultado.inventario);
        setError('');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar los sistemas.');
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarDatos, recarga]);

  const refrescar = useCallback(() => setRecarga((valor) => valor + 1), []);

  const reintentar = () => {
    setCargando(true);
    refrescar();
  };

  // Cerrar el autocompletado al hacer clic fuera
  useEffect(() => {
    function alHacerClicFuera(evento) {
      if (contenedorSugerencias.current && !contenedorSugerencias.current.contains(evento.target)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera);
    return () => document.removeEventListener('mousedown', alHacerClicFuera);
  }, []);

  const cargarMaterialesDelSistema = useCallback(async (sistemaId) => {
    setCargandoMateriales(true);
    try {
      const consultaCompleta = () =>
        supabase
          .from('sistema_materiales')
          .select(
            `id, cantidad_requerida, tipo_pieza, formula_largo, formula_config,
             angulo_corte, descuento_mm, merma_porcentaje, es_vidrio, orden,
             material:material_id (id, nombre, codigo_referencia, unidad_medida, precio_venta, categoria)`,
          )
          .eq('sistema_id', sistemaId)
          .order('orden', { ascending: true });

      let { data, error: errorConsulta } = await consultaCompleta();
      let usaRespaldo = false;

      // Si aún no se aplicó la migración 008, se consulta sin las columnas nuevas.
      if (errorConsulta && /formula_config|angulo_corte/i.test(errorConsulta.message || '')) {
        usaRespaldo = true;
        const respaldo = await supabase
          .from('sistema_materiales')
          .select(
            `id, cantidad_requerida, tipo_pieza, formula_largo, descuento_mm,
             merma_porcentaje, es_vidrio, orden,
             material:material_id (id, nombre, codigo_referencia, unidad_medida, precio_venta, categoria)`,
          )
          .eq('sistema_id', sistemaId)
          .order('orden', { ascending: true });
        data = respaldo.data;
        errorConsulta = respaldo.error;
      }

      if (errorConsulta) throw errorConsulta;
      setSoportaDespieceAvanzado(!usaRespaldo);
      setMaterialesDelSistema(data ?? []);
    } catch (err) {
      mostrar('No se pudieron cargar los materiales', err.message);
    } finally {
      setCargandoMateriales(false);
    }
  }, [mostrar]);

  const abrirNuevo = () => {
    if (!puedeEditar) return;
    setSistemaEditando(null);
    setForm(FORM_SISTEMA_VACIO);
    setErrorForm('');
    setModalSistema(true);
  };

  const abrirEditar = (sistema) => {
    if (!puedeEditar) return;
    setSistemaEditando(sistema);
    setForm({
      nombre: sistema.nombre || '',
      linea: sistema.linea || LINEAS_SISTEMA[0],
      tipo: sistema.tipo || 'corrediza',
      descripcion: sistema.descripcion || '',
      largoBarra: String(sistema.largo_barra_cm ?? LARGO_BARRA_DEFECTO_CM),
      descuentoVidrioAncho: String(sistema.descuento_vidrio_ancho_mm ?? 30),
      descuentoVidrioAlto: String(sistema.descuento_vidrio_alto_mm ?? 30),
      descuentoPerfilAncho: String(sistema.descuento_perfil_ancho_mm ?? 0),
      descuentoPerfilAlto: String(sistema.descuento_perfil_alto_mm ?? 0),
      merma: String(sistema.merma_porcentaje ?? 5),
    });
    setErrorForm('');
    setModalSistema(true);
  };

  const handleGuardarSistema = async (evento) => {
    evento.preventDefault();
    if (!puedeEditar) {
      setErrorForm(
        'Solo el Super Admin y el Jefe de Taller pueden modificar sistemas, fórmulas y descuentos.',
      );
      return;
    }
    setGuardando(true);
    setErrorForm('');

    try {
      const nombre = form.nombre.trim();
      if (!nombre) throw new Error('El nombre del sistema es obligatorio.');

      const numero = (valor, defecto = 0) => {
        const n = Number(String(valor).replace(',', '.'));
        return Number.isFinite(n) ? n : defecto;
      };

      const payload = {
        nombre,
        linea: form.linea,
        tipo: form.tipo,
        descripcion: form.descripcion.trim(),
        largo_barra_cm: numero(form.largoBarra, LARGO_BARRA_DEFECTO_CM) || LARGO_BARRA_DEFECTO_CM,
        descuento_vidrio_ancho_mm: numero(form.descuentoVidrioAncho, 30),
        descuento_vidrio_alto_mm: numero(form.descuentoVidrioAlto, 30),
        descuento_perfil_ancho_mm: numero(form.descuentoPerfilAncho, 0),
        descuento_perfil_alto_mm: numero(form.descuentoPerfilAlto, 0),
        merma_porcentaje: numero(form.merma, 5),
      };

      // Fallback: si la migración 008 aún no está aplicada, guarda sin largo_barra_cm.
      const guardar = async (datos) => {
        if (sistemaEditando) {
          return supabase
            .from('sistemas_trabajo')
            .update(datos)
            .eq('id', sistemaEditando.id);
        }
        return supabase.from('sistemas_trabajo').insert([{ id: nuevoId(), ...datos }]);
      };

      let respuesta = await guardar(payload);
      if (respuesta.error && /largo_barra_cm/i.test(respuesta.error.message || '')) {
        respuesta = await guardar(sinColumnas(payload, ['largo_barra_cm']));
      }
      if (respuesta.error) throw respuesta.error;

      mostrar(
        sistemaEditando ? '¡Actualizado!' : '¡Sistema Creado!',
        sistemaEditando
          ? 'El sistema fue modificado correctamente.'
          : 'El sistema de trabajo fue registrado.',
        'exito',
      );

      setModalSistema(false);
      refrescar();
    } catch (err) {
      setErrorForm(err.message || 'Error al guardar el sistema.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarSistema = async (sistema) => {
    if (!puedeEditar) {
      mostrar(
        'Sin permiso',
        'Solo el Super Admin y el Jefe de Taller pueden eliminar sistemas.',
      );
      return;
    }
    const confirmado = window.confirm(
      `¿Eliminar el sistema "${sistema.nombre}" y sus materiales asociados?`,
    );
    if (!confirmado) return;

    try {
      const { error: errorDelete } = await supabase
        .from('sistemas_trabajo')
        .delete()
        .eq('id', sistema.id);
      if (errorDelete) throw errorDelete;
      mostrar('Sistema eliminado', `Se eliminó ${sistema.nombre}.`, 'exito');
      refrescar();
    } catch (err) {
      mostrar('Error al eliminar', err.message);
    }
  };

  const limpiarFormularioMaterial = () => {
    setTextoBusquedaMaterial('');
    setMaterialSeleccionado(null);
    setMostrarSugerencias(false);
    setCantidadRequerida(FORM_MATERIAL_VACIO.cantidad);
    setTipoPieza(FORM_MATERIAL_VACIO.tipoPieza);
    setFormulaLargo(FORM_MATERIAL_VACIO.formula);
    setDescuentoMm(FORM_MATERIAL_VACIO.descuento);
    setMermaLinea(FORM_MATERIAL_VACIO.merma);
    setRestarCm(FORM_MATERIAL_VACIO.restarCm);
    setDividir(FORM_MATERIAL_VACIO.dividir);
    setReferencia(FORM_MATERIAL_VACIO.referencia);
    setAngulo(FORM_MATERIAL_VACIO.angulo);
    setLineaEditando(null);
  };

  const abrirMateriales = async (sistema) => {
    setSistemaSeleccionado(sistema);
    limpiarFormularioMaterial();
    setMaterialesDelSistema([]);
    setModalMateriales(true);
    await cargarMaterialesDelSistema(sistema.id);
  };

  // Panel de descuentos: crea, edita y elimina piezas de la receta viendo el
  // despiece resultante en vivo. Comparte la lista de materiales con el modal
  // de materiales porque nunca se abren al mismo tiempo.
  const abrirDescuentos = async (sistema) => {
    setSistemaDescuentos(sistema);
    setMaterialesDelSistema([]);
    setModalDescuentos(true);
    await cargarMaterialesDelSistema(sistema.id);
  };

  const recargarMaterialesDescuentos = useCallback(async () => {
    if (!sistemaDescuentos) return;
    await cargarMaterialesDelSistema(sistemaDescuentos.id);
  }, [cargarMaterialesDelSistema, sistemaDescuentos]);

  const alActualizarSistemaDescuentos = useCallback(
    (cambios = {}) => {
      setSistemaDescuentos((prev) => (prev ? { ...prev, ...cambios } : prev));
      refrescar();
    },
    [refrescar],
  );

  const sugerencias = useMemo(() => {
    const texto = textoBusquedaMaterial.toLowerCase().trim();
    if (!texto) return [];
    return inventario
      .filter(
        (material) =>
          material.nombre?.toLowerCase().includes(texto) ||
          material.codigo_referencia?.toLowerCase().includes(texto),
      )
      .slice(0, 25);
  }, [inventario, textoBusquedaMaterial]);

  const seleccionarMaterial = (material) => {
    setMaterialSeleccionado(material);
    setTextoBusquedaMaterial(`${material.nombre} (${material.unidad_medida})`);
    setMostrarSugerencias(false);
  };

  const numero = (valor, defecto = 0) => {
    const n = Number(String(valor ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : defecto;
  };

  const editarLinea = (item) => {
    if (!puedeEditar) return;
    const config = configuracionFormula(item);
    setLineaEditando(item.id);
    setMaterialSeleccionado(item.material || null);
    setTextoBusquedaMaterial(
      item.material ? `${item.material.nombre} (${item.material.unidad_medida})` : '',
    );
    setCantidadRequerida(String(item.cantidad_requerida ?? 1));
    setTipoPieza(item.tipo_pieza || 'accesorio');
    setFormulaLargo(config.base || item.formula_largo || 'fijo');
    setDescuentoMm(String(item.descuento_mm ?? 0));
    setMermaLinea(String(item.merma_porcentaje ?? 0));
    setRestarCm(String(config.restarCm ?? 0));
    setDividir(String(config.dividir ?? 1));
    setReferencia(config.referencia || '');
    setAngulo(String(config.angulo ?? 0));
    setMostrarSugerencias(false);
  };

  const agregarMaterial = async (evento) => {
    evento.preventDefault();

    if (!puedeEditar) {
      mostrar(
        'Sin permiso',
        'Solo el Super Admin y el Jefe de Taller pueden modificar recetas, fórmulas y descuentos.',
      );
      return;
    }

    if (!materialSeleccionado) {
      mostrar('Selección requerida', 'Elige un material del autocompletado.');
      return;
    }

    const cantidad = parseFloat(String(cantidadRequerida).replace(',', '.'));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      mostrar('Cantidad inválida', 'La cantidad debe ser mayor que cero.');
      return;
    }

    setAgregandoMaterial(true);
    try {
      const metadata = {
        cantidad_requerida: cantidad,
        tipo_pieza: tipoPieza,
        formula_largo: tipoPieza === 'perfil' ? formulaLargo : 'fijo',
        formula_config:
          tipoPieza === 'perfil'
            ? {
                base: formulaLargo,
                restarCm: Math.max(0, numero(restarCm, 0)),
                dividir: Math.max(1, numero(dividir, 1) || 1),
                referencia: formulaLargo === 'referencia' ? referencia.trim() : '',
                angulo: Math.max(0, numero(angulo, 0)),
              }
            : {
                base: 'fijo',
                restarCm: 0,
                dividir: 1,
                referencia: '',
                angulo: 0,
              },
        angulo_corte:
          tipoPieza === 'perfil' ? Math.max(0, numero(angulo, 0)) : 0,
        descuento_mm: Math.max(0, numero(descuentoMm, 0)),
        merma_porcentaje: Math.max(0, numero(mermaLinea, 0)),
        es_vidrio: tipoPieza === 'vidrio',
      };

      if (lineaEditando) {
        const actualizarMetadata = (datos) =>
          supabase.from('sistema_materiales').update(datos).eq('id', lineaEditando);

        let respuesta = await actualizarMetadata(metadata);
        // Respaldo si falta la migración 008.
        if (respuesta.error && /formula_config|angulo_corte/i.test(respuesta.error.message || '')) {
          respuesta = await actualizarMetadata(sinColumnas(metadata, ['formula_config', 'angulo_corte']));
        }
        if (respuesta.error) throw respuesta.error;
        mostrar('Línea actualizada', 'La pieza de la receta fue modificada.', 'exito');
      } else {
        const siguienteOrden = materialesDelSistema.reduce(
          (maximo, item) => Math.max(maximo, Number(item.orden) || 0),
          0,
        );
        const insertarMetadata = (datos) =>
          supabase.from('sistema_materiales').insert([
            {
              id: nuevoId(),
              sistema_id: sistemaSeleccionado.id,
              material_id: materialSeleccionado.id,
              orden: siguienteOrden + 1,
              ...datos,
            },
          ]);

        let respuesta = await insertarMetadata(metadata);
        if (respuesta.error && /formula_config|angulo_corte/i.test(respuesta.error.message || '')) {
          respuesta = await insertarMetadata(sinColumnas(metadata, ['formula_config', 'angulo_corte']));
        }
        if (respuesta.error) throw respuesta.error;
        mostrar('Material agregado', 'El material quedó asociado al sistema.', 'exito');
      }

      limpiarFormularioMaterial();
      await cargarMaterialesDelSistema(sistemaSeleccionado.id);
    } catch (err) {
      mostrar('No se pudo guardar', err.message);
    } finally {
      setAgregandoMaterial(false);
    }
  };

  const eliminarMaterialDeSistema = async (relacionId) => {
    if (!puedeEditar) {
      mostrar(
        'Sin permiso',
        'Solo el Super Admin y el Jefe de Taller pueden quitar piezas de la receta.',
      );
      return;
    }
    try {
      const { error: errorDelete } = await supabase
        .from('sistema_materiales')
        .delete()
        .eq('id', relacionId);
      if (errorDelete) throw errorDelete;
      await cargarMaterialesDelSistema(sistemaSeleccionado.id);
    } catch (err) {
      mostrar('Error al quitar material', err.message);
    }
  };

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return sistemas;
    return sistemas.filter((sistema) =>
      [sistema.nombre, sistema.linea, sistema.descripcion]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto)),
    );
  }, [sistemas, busqueda]);

  const costoEstimado = useMemo(
    () =>
      materialesDelSistema.reduce(
        (total, item) =>
          total + Number(item.material?.precio_venta || 0) * Number(item.cantidad_requerida || 0),
        0,
      ),
    [materialesDelSistema],
  );

  // Vista previa con una ventana de referencia de 120 × 100 cm.
  const despiecePreview = useMemo(() => {
    if (!sistemaSeleccionado) return null;
    const sistema = {
      ...sistemaSeleccionado,
      materiales: materialesDelSistema.map((linea) => ({
        ...linea,
        material: linea.material,
        categoria: linea.material?.categoria,
      })),
    };

    return generarDespiece(
      [
        {
          id: 'preview',
          sistema_id: sistemaSeleccionado.id,
          descripcion: `Muestra 120 × 100 cm`,
          ancho_cm: 120,
          alto_cm: 100,
          cantidad: 1,
        },
      ],
      [sistema],
    );
  }, [sistemaSeleccionado, materialesDelSistema]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Sistemas y Recetas</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configura los sistemas de ventanería, puertas y los materiales que componen cada uno.
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} /> Nuevo Sistema
          </button>
        )}
      </div>

      {!puedeEditar && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-[11px] leading-relaxed text-amber-200">
          <Lock size={15} className="mt-0.5 shrink-0" />
          <p>
            Solo el <strong>Super Admin</strong> y el <strong>Jefe de Taller</strong> pueden crear
            o modificar sistemas, recetas, fórmulas y descuentos de fabricación. Puedes consultar
            las medidas y recetas, pero no editarlas.
          </p>
        </div>
      )}

      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar sistema por nombre, línea o descripción..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
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
            onClick={reintentar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-semibold shrink-0"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Sistema / Modelo</th>
                <th className="p-4">Línea</th>
                <th className="p-4">Descripción</th>
                <th className="p-4 text-center">Receta y descuentos</th>
                {puedeEditar && <th className="p-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan={puedeEditar ? 5 : 4} className="text-center py-8 text-slate-500">
                    Cargando sistemas...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={puedeEditar ? 5 : 4} className="text-center py-8 text-slate-500">
                    {sistemas.length === 0
                      ? 'No hay sistemas registrados.'
                      : 'Ningún sistema coincide con la búsqueda.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((sistema) => (
                  <tr key={sistema.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Layers size={16} />
                        </div>
                        <span className="truncate">{sistema.nombre}</span>
                      </div>
                    </td>
                    <td className="p-4 text-blue-400 font-semibold whitespace-nowrap">
                      {sistema.linea}
                    </td>
                    <td className="p-4 text-slate-300 max-w-xs truncate">
                      {sistema.descripcion || 'Sin descripción'}
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => abrirMateriales(sistema)}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold rounded-xl border border-blue-500/20 transition-all inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap"
                        >
                          <Package size={14} /> Gestionar Materiales
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirDescuentos(sistema)}
                          title="Crear, editar o eliminar los descuentos y ver el despiece"
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 transition-all inline-flex items-center gap-1.5 text-[11px] whitespace-nowrap"
                        >
                          <Calculator size={14} /> Descuentos
                        </button>
                      </div>
                    </td>
                    {puedeEditar && (
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => abrirEditar(sistema)}
                            title="Editar sistema"
                            aria-label={`Editar ${sistema.nombre}`}
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarSistema(sistema)}
                            title="Eliminar sistema"
                            aria-label={`Eliminar ${sistema.nombre}`}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal sistema */}
      <Modal
        abierto={modalSistema}
        onClose={() => setModalSistema(false)}
        icono={<Layers size={20} />}
        titulo={sistemaEditando ? 'Editar Sistema' : 'Nuevo Sistema de Trabajo'}
        subtitulo="Define la línea de perfilería y sus especificaciones."
      >
        <form onSubmit={handleGuardarSistema} className="space-y-4">
          {errorForm && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" />
              {errorForm}
            </div>
          )}

          <div>
            <label htmlFor="sistema-nombre" className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre del Sistema
            </label>
            <input
              id="sistema-nombre"
              type="text"
              value={form.nombre}
              onChange={(evento) => setForm((prev) => ({ ...prev, nombre: evento.target.value }))}
              placeholder="Ej. Ventana Corrediza 50/20 (2 Hojas)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sistema-linea" className="block text-xs font-semibold text-slate-300 mb-1">
                Línea o Perfilería
              </label>
              <select
                id="sistema-linea"
                value={form.linea}
                onChange={(evento) => setForm((prev) => ({ ...prev, linea: evento.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {opcionesLinea.map((linea) => (
                  <option key={linea} value={linea}>
                    {linea}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sistema-tipo" className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de sistema
              </label>
              <select
                id="sistema-tipo"
                value={form.tipo}
                onChange={(evento) => setForm((prev) => ({ ...prev, tipo: evento.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 capitalize"
              >
                {TIPOS_SISTEMA.map((tipo) => (
                  <option key={tipo} value={tipo} className="capitalize">
                    {tipo.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Descuentos de fabricación
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label htmlFor="desc-vidrio-ancho" className="block text-[10px] text-slate-400 mb-1">
                  Vidrio ancho (mm)
                </label>
                <input
                  id="desc-vidrio-ancho"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.descuentoVidrioAncho}
                  onChange={(evento) =>
                    setForm((prev) => ({ ...prev, descuentoVidrioAncho: evento.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="desc-vidrio-alto" className="block text-[10px] text-slate-400 mb-1">
                  Vidrio alto (mm)
                </label>
                <input
                  id="desc-vidrio-alto"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.descuentoVidrioAlto}
                  onChange={(evento) =>
                    setForm((prev) => ({ ...prev, descuentoVidrioAlto: evento.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="desc-perfil-ancho" className="block text-[10px] text-slate-400 mb-1">
                  Perfil ancho (mm)
                </label>
                <input
                  id="desc-perfil-ancho"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.descuentoPerfilAncho}
                  onChange={(evento) =>
                    setForm((prev) => ({ ...prev, descuentoPerfilAncho: evento.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="desc-perfil-alto" className="block text-[10px] text-slate-400 mb-1">
                  Perfil alto (mm)
                </label>
                <input
                  id="desc-perfil-alto"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.descuentoPerfilAlto}
                  onChange={(evento) =>
                    setForm((prev) => ({ ...prev, descuentoPerfilAlto: evento.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <div>
                <label htmlFor="largo-barra" className="block text-[10px] text-slate-400 mb-1">
                  Largo de barra (cm)
                </label>
                <input
                  id="largo-barra"
                  type="number"
                  min="1"
                  step="0.1"
                  value={form.largoBarra}
                  onChange={(evento) =>
                    setForm((prev) => ({ ...prev, largoBarra: evento.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="merma-sistema" className="block text-[10px] text-slate-400 mb-1">
                  Merma general (%)
                </label>
                <input
                  id="merma-sistema"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.merma}
                  onChange={(evento) => setForm((prev) => ({ ...prev, merma: evento.target.value }))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Escribe el largo real de la barra de perfil (en este taller: 595 cm). El descuento se
              resta al vidrio y a cada corte al calcular el despiece de la orden.
            </p>
          </div>

          <div>
            <label
              htmlFor="sistema-descripcion"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Descripción / Especificaciones
            </label>
            <textarea
              id="sistema-descripcion"
              rows="3"
              value={form.descripcion}
              onChange={(evento) =>
                setForm((prev) => ({ ...prev, descripcion: evento.target.value }))
              }
              placeholder="Ej. Requiere 2 topes, 2 enganches, 2 jambas, 1 sillar, 1 cabezal..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalSistema(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar Sistema'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal materiales */}
      <Modal
        abierto={modalMateriales}
        onClose={() => setModalMateriales(false)}
        icono={<Package size={20} />}
        titulo={sistemaSeleccionado ? `Materiales de: ${sistemaSeleccionado.nombre}` : 'Materiales'}
        subtitulo="Autocompletado predictivo sobre el inventario."
        ancho="max-w-2xl"
      >
        {puedeEditar && (
          <form
            onSubmit={agregarMaterial}
            className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800"
          >
            {lineaEditando && (
              <div className="flex items-center justify-between gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2">
                <p className="text-[11px] text-blue-300 font-semibold">
                  Editando una línea de la receta
                </p>
                <button
                  type="button"
                  onClick={limpiarFormularioMaterial}
                  className="text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded-lg"
                >
                  Cancelar edición
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 relative" ref={contenedorSugerencias}>
                <label
                  htmlFor="buscar-material"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Buscar material (ej. “tope”, “jamba”, “rodachina”)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                  <input
                    id="buscar-material"
                    type="text"
                    autoComplete="off"
                    value={textoBusquedaMaterial}
                    onChange={(evento) => {
                      setTextoBusquedaMaterial(evento.target.value);
                      setMostrarSugerencias(true);
                      setMaterialSeleccionado(null);
                    }}
                    onFocus={() => setMostrarSugerencias(true)}
                    placeholder="Escribe para autocompletar..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                {mostrarSugerencias && textoBusquedaMaterial.trim() !== '' && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {sugerencias.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">
                        No se encontraron materiales coincidentes.
                      </div>
                    ) : (
                      sugerencias.map((material) => (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => seleccionarMaterial(material)}
                          className="w-full text-left p-2.5 hover:bg-blue-600/20 transition-colors text-xs flex justify-between items-center gap-3"
                        >
                          <span className="min-w-0">
                            <span className="block font-bold text-white truncate">
                              {material.nombre}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Ref: {material.codigo_referencia || 'N/A'} · {material.unidad_medida}
                            </span>
                          </span>
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-mono shrink-0">
                            {formatCOP(material.precio_venta)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="cantidad-material"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Cantidad
                </label>
                <div className="flex gap-2">
                  <input
                    id="cantidad-material"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={cantidadRequerida}
                    onChange={(evento) => setCantidadRequerida(evento.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={agregandoMaterial || !materialSeleccionado}
                    aria-label={lineaEditando ? 'Guardar línea' : 'Agregar material'}
                    title={lineaEditando ? 'Guardar cambios' : 'Agregar material'}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-md transition-all shrink-0 disabled:opacity-50"
                  >
                    {lineaEditando ? <Edit2 size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label
                  htmlFor="tipo-pieza"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Tipo de pieza
                </label>
                <select
                  id="tipo-pieza"
                  value={tipoPieza}
                  onChange={(evento) => {
                    const valor = evento.target.value;
                    setTipoPieza(valor);
                    if (valor === 'perfil' && formulaLargo === 'fijo') setFormulaLargo('perimetro');
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500"
                >
                  {TIPOS_PIEZA.map((tipo) => (
                    <option key={tipo.valor} value={tipo.valor}>
                      {tipo.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="formula-corte"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Fórmula de corte
                </label>
                <select
                  id="formula-corte"
                  value={formulaLargo}
                  onChange={(evento) => setFormulaLargo(evento.target.value)}
                  disabled={tipoPieza !== 'perfil'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  {FORMULAS_CORTE.map((formula) => (
                    <option key={formula.valor} value={formula.valor}>
                      {formula.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="descuento-linea"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Descuento (mm)
                </label>
                <input
                  id="descuento-linea"
                  type="number"
                  min="0"
                  step="0.1"
                  value={descuentoMm}
                  onChange={(evento) => setDescuentoMm(evento.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="merma-linea"
                  className="block text-[10px] font-semibold text-slate-400 mb-1"
                >
                  Merma (%)
                </label>
                <input
                  id="merma-linea"
                  type="number"
                  min="0"
                  step="0.1"
                  value={mermaLinea}
                  onChange={(evento) => setMermaLinea(evento.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {tipoPieza === 'perfil' && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-cyan-400">
                  Fórmula avanzada · (base − restar cm − descuento) ÷ dividir
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label
                      htmlFor="restar-cm"
                      className="block text-[10px] font-semibold text-slate-400 mb-1"
                    >
                      Restar (cm)
                    </label>
                    <input
                      id="restar-cm"
                      type="number"
                      min="0"
                      step="0.1"
                      value={restarCm}
                      onChange={(evento) => setRestarCm(evento.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="dividir-linea"
                      className="block text-[10px] font-semibold text-slate-400 mb-1"
                    >
                      Dividir entre
                    </label>
                    <input
                      id="dividir-linea"
                      type="number"
                      min="1"
                      step="1"
                      value={dividir}
                      onChange={(evento) => setDividir(evento.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="angulo-linea"
                      className="block text-[10px] font-semibold text-slate-400 mb-1"
                    >
                      Ángulo de corte (°)
                    </label>
                    <input
                      id="angulo-linea"
                      type="number"
                      min="0"
                      step="0.1"
                      value={angulo}
                      onChange={(evento) => setAngulo(evento.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="referencia-linea"
                      className="block text-[10px] font-semibold text-slate-400 mb-1"
                    >
                      Pieza de referencia
                    </label>
                    <input
                      id="referencia-linea"
                      type="text"
                      value={referencia}
                      onChange={(evento) => setReferencia(evento.target.value)}
                      disabled={formulaLargo !== 'referencia'}
                      placeholder="Ej. PV17 Ancho"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  Jamba 50/20: base alto, restar 1.3 cm, ángulo 5°. Horizontal: base ancho, restar
                  2.8 cm, dividir 4. Barra toallera: fórmula “medida de otra pieza”, referencia
                  “PV17 Ancho”, restar 9 cm.
                </p>
              </div>
            )}
          </form>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              Materiales configurados
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                {materialesDelSistema.length} ítems · Costo estimado:{' '}
                <span className="text-emerald-400 font-bold">{formatCOP(costoEstimado)}</span>
              </span>
              {materialesDelSistema.length > 0 && (
                <button
                  type="button"
                  onClick={() => setVerPreview((valor) => !valor)}
                  className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-2.5 py-1 rounded-lg"
                >
                  {verPreview ? 'Ocultar muestra' : 'Ver muestra 120×100'}
                </button>
              )}
            </div>
          </div>

          {cargandoMateriales ? (
            <p className="text-xs text-slate-500 py-4 text-center">Cargando materiales...</p>
          ) : materialesDelSistema.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No hay materiales asociados a este sistema todavía.
            </p>
          ) : (
            <div className="divide-y divide-slate-800 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
              {materialesDelSistema.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-slate-900/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {item.material?.nombre || 'Material eliminado'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Ref: {item.material?.codigo_referencia || 'N/A'} ·{' '}
                      {etiquetaTipoPieza(item.tipo_pieza)}
                      {item.tipo_pieza === 'perfil'
                        ? ` · ${describirFormula(
                            item.formula_largo,
                            configuracionFormula(item),
                          )}`
                        : ''}
                      {Number(item.descuento_mm) > 0
                        ? ` · −${Number(item.descuento_mm)} mm`
                        : ''}
                      {Number(item.merma_porcentaje) > 0
                        ? ` · merma ${Number(item.merma_porcentaje)}%`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 whitespace-nowrap">
                      Cant: {item.cantidad_requerida}
                    </span>
                    {puedeEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => editarLinea(item)}
                          aria-label="Editar línea de la receta"
                          className="text-blue-400 hover:text-blue-300 p-1"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarMaterialDeSistema(item.id)}
                          aria-label="Quitar material del sistema"
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {verPreview && despiecePreview && (
            <div className="pt-2">
              <DespiecePanel
                despiece={despiecePreview}
                titulo="Muestra de despiece (120 × 100 cm)"
                compacto
              />
            </div>
          )}
        </div>
      </Modal>

      <DescuentosSistema
        key={`${sistemaDescuentos?.id ?? 'sin'}-${materialesDelSistema
          .map((linea) => linea.id)
          .join('|')}`}
        abierto={modalDescuentos}
        sistema={sistemaDescuentos}
        materiales={materialesDelSistema}
        inventario={inventario}
        puedeEditar={puedeEditar}
        soportaAvanzado={soportaDespieceAvanzado}
        onClose={() => setModalDescuentos(false)}
        onRecargarMateriales={recargarMaterialesDescuentos}
        onSistemaActualizado={alActualizarSistemaDescuentos}
        mostrar={mostrar}
      />
    </div>
  );
}
