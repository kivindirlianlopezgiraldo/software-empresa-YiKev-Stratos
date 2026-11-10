import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Edit2,
  Filter,
  Plus,
  Recycle,
  RefreshCw,
  Ruler,
  Search,
  Trash2,
  User,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  CATEGORIAS_INVENTARIO_PRODUCCION,
  COLORES_RETAL,
  UNIDADES_MEDIDA,
  permisosDe,
} from '../lib/constants';
import { formatFechaHora, nuevoId } from '../lib/format';
import { LARGO_BARRA_DEFECTO_CM } from '../lib/despiece';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import useToast from '../hooks/useToast';

const FORM_VACIO = () => ({
  nombre: '',
  categoria: CATEGORIAS_INVENTARIO_PRODUCCION[0],
  unidadMedida: UNIDADES_MEDIDA[0],
  stockActual: '',
  stockMinimo: '',
  ubicacion: '',
  colaboradorId: '',
  notas: '',
});

const FORM_RETAL_VACIO = () => ({
  codigo: '',
  materialNombre: '',
  color: COLORES_RETAL[0],
  largo: '',
  ancho: '',
  cantidad: '1',
  ubicacion: '',
  disponible: true,
  notas: '',
});

function explicarError(err) {
  const texto = err?.message || '';
  if (/retales_produccion/i.test(texto)) {
    return (
      'Falta aplicar la migración 008 en Supabase (retales de producción). ' +
      'Ejecuta supabase/migrations/008_despiece_avanzado_retales.sql en el SQL Editor. ' +
      `Detalle: ${texto}`
    );
  }
  if (/inventario_produccion|relation|does not exist|columna/i.test(texto)) {
    return (
      'Falta aplicar la migración 005 en Supabase (inventario de producción). ' +
      'Ejecuta supabase/migrations/005_produccion_herramientas_ia.sql en el SQL Editor. ' +
      `Detalle: ${texto}`
    );
  }
  return texto;
}

const numero = (valor, defecto = 0) => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : defecto;
};

export default function InventarioProduccion({ perfil, permisos: permisosProp }) {
  const permisos = useMemo(
    () => permisosProp || permisosDe(perfil?.rol),
    [permisosProp, perfil?.rol],
  );

  const esSoloProduccion =
    permisos.esProduccion && !permisos.esAdmin && !permisos.esJefe && !permisos.esBodega;

  const [insumos, setInsumos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');
  const [filtroColaborador, setFiltroColaborador] = useState(() =>
    esSoloProduccion && perfil?.id ? perfil.id : 'TODOS',
  );

  const [modalAbierto, setModalAbierto] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [vista, setVista] = useState('insumos');
  const [retales, setRetales] = useState([]);
  const [retalesDisponibles, setRetalesDisponibles] = useState(true);
  const [modalRetal, setModalRetal] = useState(false);
  const [retalEditando, setRetalEditando] = useState(null);
  const [formRetal, setFormRetal] = useState(FORM_RETAL_VACIO);
  const [errorRetal, setErrorRetal] = useState('');
  const [guardandoRetal, setGuardandoRetal] = useState(false);

  const { alerta, mostrar, cerrar } = useToast();

  const consultar = useCallback(async () => {
    const [resInsumos, resColaboradores, resRetales] = await Promise.all([
      supabase
        .from('inventario_produccion')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('perfiles_usuario')
        .select('id, nombre_completo, rol, activo')
        .order('nombre_completo', { ascending: true }),
      supabase
        .from('retales_produccion')
        .select('*')
        .order('creado_en', { ascending: false }),
    ]);

    if (resInsumos.error) throw resInsumos.error;

    return {
      insumos: resInsumos.data ?? [],
      colaboradores: resColaboradores.error ? [] : resColaboradores.data ?? [],
      retales: resRetales.error ? [] : resRetales.data ?? [],
      errorRetales: resRetales.error ?? null,
    };
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const datos = await consultar();
        if (!activo) return;
        setInsumos(datos.insumos);
        setColaboradores(datos.colaboradores.filter((c) => c.activo !== false));
        setRetales(datos.retales);
        setRetalesDisponibles(!datos.errorRetales);
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

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const abrirNuevo = () => {
    setInsumoEditando(null);
    setForm({
      ...FORM_VACIO(),
      colaboradorId: esSoloProduccion ? perfil?.id || '' : '',
    });
    setErrorForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (insumo) => {
    setInsumoEditando(insumo);
    setForm({
      nombre: insumo.nombre || '',
      categoria: insumo.categoria || CATEGORIAS_INVENTARIO_PRODUCCION[0],
      unidadMedida: insumo.unidad_medida || UNIDADES_MEDIDA[0],
      stockActual: insumo.stock_actual !== null ? String(insumo.stock_actual) : '',
      stockMinimo: insumo.stock_minimo !== null ? String(insumo.stock_minimo) : '',
      ubicacion: insumo.ubicacion || '',
      colaboradorId: insumo.colaborador_id || '',
      notas: insumo.notas || '',
    });
    setErrorForm('');
    setModalAbierto(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) {
      setErrorForm('El nombre del insumo es obligatorio.');
      return;
    }

    setGuardando(true);
    setErrorForm('');

    try {
      const colaborador = colaboradores.find((c) => c.id === form.colaboradorId);

      const payload = {
        nombre,
        categoria: form.categoria,
        unidad_medida: form.unidadMedida,
        stock_actual: Math.max(0, numero(form.stockActual, 0)),
        stock_minimo: Math.max(0, numero(form.stockMinimo, 0)),
        ubicacion: form.ubicacion.trim() || null,
        colaborador_id: colaborador?.id ?? null,
        colaborador_nombre: colaborador?.nombre_completo ?? null,
        notas: form.notas.trim() || null,
        actualizado_en: new Date().toISOString(),
      };

      if (insumoEditando) {
        const { error: errorUpdate } = await supabase
          .from('inventario_produccion')
          .update(payload)
          .eq('id', insumoEditando.id);
        if (errorUpdate) throw errorUpdate;
        mostrar('Insumo actualizado', 'El inventario de producción quedó al día.', 'exito');
      } else {
        const { error: errorInsert } = await supabase.from('inventario_produccion').insert([
          {
            id: nuevoId(),
            ...payload,
            creado_por: perfil?.id ?? null,
            creado_por_nombre: perfil?.nombre_completo ?? null,
          },
        ]);
        if (errorInsert) throw errorInsert;
        mostrar('Insumo registrado', 'Ya está disponible para el equipo de producción.', 'exito');
      }

      setModalAbierto(false);
      refrescar();
    } catch (err) {
      setErrorForm(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const ajustarStock = async (insumo, delta) => {
    const nuevo = Math.max(0, Number(insumo.stock_actual || 0) + delta);
    try {
      const { error: errorUpdate } = await supabase
        .from('inventario_produccion')
        .update({ stock_actual: nuevo, actualizado_en: new Date().toISOString() })
        .eq('id', insumo.id);
      if (errorUpdate) throw errorUpdate;
      setInsumos((prev) =>
        prev.map((fila) => (fila.id === insumo.id ? { ...fila, stock_actual: nuevo } : fila)),
      );
    } catch (err) {
      mostrar('No se pudo ajustar el stock', explicarError(err));
    }
  };

  const eliminar = async (insumo) => {
    if (!window.confirm(`¿Eliminar el insumo "${insumo.nombre}" del inventario de producción?`)) {
      return;
    }
    try {
      const { error: errorDelete } = await supabase
        .from('inventario_produccion')
        .delete()
        .eq('id', insumo.id);
      if (errorDelete) throw errorDelete;
      mostrar('Insumo eliminado', 'Se quitó del inventario de producción.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo eliminar', explicarError(err));
    }
  };

  // -------------------------------------------------------------------------
  // Retales de producción
  // -------------------------------------------------------------------------
  const abrirNuevoRetal = () => {
    setRetalEditando(null);
    setFormRetal(FORM_RETAL_VACIO());
    setErrorRetal('');
    setModalRetal(true);
  };

  const abrirEditarRetal = (retal) => {
    setRetalEditando(retal);
    setFormRetal({
      codigo: retal.codigo || '',
      materialNombre: retal.material_nombre || '',
      color: retal.color || COLORES_RETAL[0],
      largo: retal.largo_cm !== null && retal.largo_cm !== undefined ? String(retal.largo_cm) : '',
      ancho: retal.ancho_cm ? String(retal.ancho_cm) : '',
      cantidad: String(retal.cantidad ?? 1),
      ubicacion: retal.ubicacion || '',
      disponible: retal.disponible !== false,
      notas: retal.notas || '',
    });
    setErrorRetal('');
    setModalRetal(true);
  };

  const actualizarCampoRetal = (campo, valor) => {
    setFormRetal((prev) => ({ ...prev, [campo]: valor }));
    if (errorRetal) setErrorRetal('');
  };

  const guardarRetal = async (evento) => {
    evento.preventDefault();
    const materialNombre = formRetal.materialNombre.trim();
    if (!materialNombre) {
      setErrorRetal('Escribe el material del retal (ej. Jamba 50/20).');
      return;
    }

    const largo = Math.max(0, numero(formRetal.largo, 0));
    if (largo <= 0) {
      setErrorRetal('El largo del retal debe ser mayor que cero.');
      return;
    }

    setGuardandoRetal(true);
    setErrorRetal('');

    try {
      const payload = {
        codigo: formRetal.codigo.trim() || null,
        material_nombre: materialNombre,
        color: formRetal.color || 'Sin definir',
        largo_cm: largo,
        ancho_cm: Math.max(0, numero(formRetal.ancho, 0)),
        cantidad: Math.max(1, Math.round(numero(formRetal.cantidad, 1))),
        ubicacion: formRetal.ubicacion.trim() || null,
        disponible: formRetal.disponible,
        notas: formRetal.notas.trim() || null,
        actualizado_en: new Date().toISOString(),
      };

      if (retalEditando) {
        const { error: errorUpdate } = await supabase
          .from('retales_produccion')
          .update(payload)
          .eq('id', retalEditando.id);
        if (errorUpdate) throw errorUpdate;
        mostrar('Retal actualizado', 'El retal quedó disponible para el despiece.', 'exito');
      } else {
        const { error: errorInsert } = await supabase.from('retales_produccion').insert([
          {
            id: nuevoId(),
            ...payload,
            creado_por: perfil?.id ?? null,
            creado_por_nombre: perfil?.nombre_completo ?? null,
          },
        ]);
        if (errorInsert) throw errorInsert;
        mostrar('Retal registrado', 'El motor de despiece ya puede reutilizarlo.', 'exito');
      }

      setModalRetal(false);
      refrescar();
    } catch (err) {
      setErrorRetal(explicarError(err));
    } finally {
      setGuardandoRetal(false);
    }
  };

  const eliminarRetal = async (retal) => {
    if (
      !window.confirm(
        `¿Eliminar el retal "${retal.codigo || retal.material_nombre}"? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    try {
      const { error: errorDelete } = await supabase
        .from('retales_produccion')
        .delete()
        .eq('id', retal.id);
      if (errorDelete) throw errorDelete;
      mostrar('Retal eliminado', 'Se quitó de los retales disponibles.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo eliminar el retal', explicarError(err));
    }
  };

  const alternarDisponible = async (retal) => {
    try {
      const { error: errorUpdate } = await supabase
        .from('retales_produccion')
        .update({
          disponible: retal.disponible === false,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', retal.id);
      if (errorUpdate) throw errorUpdate;
      setRetales((prev) =>
        prev.map((fila) =>
          fila.id === retal.id ? { ...fila, disponible: fila.disponible === false } : fila,
        ),
      );
    } catch (err) {
      mostrar('No se pudo actualizar el retal', explicarError(err));
    }
  };

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return insumos.filter((insumo) => {
      if (filtroCategoria !== 'TODAS' && insumo.categoria !== filtroCategoria) return false;
      if (filtroColaborador !== 'TODOS') {
        if (filtroColaborador === 'SIN_ASIGNAR' && insumo.colaborador_id) return false;
        if (
          filtroColaborador !== 'SIN_ASIGNAR' &&
          insumo.colaborador_id !== filtroColaborador
        ) {
          return false;
        }
      }
      if (!texto) return true;
      return [insumo.nombre, insumo.categoria, insumo.ubicacion, insumo.colaborador_nombre, insumo.notas]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto));
    });
  }, [insumos, busqueda, filtroCategoria, filtroColaborador]);

  const resumen = useMemo(
    () => ({
      total: insumos.length,
      criticos: insumos.filter(
        (insumo) => Number(insumo.stock_actual) <= Number(insumo.stock_minimo || 0),
      ).length,
      propios: insumos.filter((insumo) => insumo.colaborador_id === perfil?.id).length,
    }),
    [insumos, perfil?.id],
  );

  const stockBajo = (insumo) =>
    Number(insumo.stock_actual) <= Number(insumo.stock_minimo || 0);

  const retalesFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return retales;
    return retales.filter((retal) =>
      [retal.codigo, retal.material_nombre, retal.color, retal.ubicacion, retal.notas]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto)),
    );
  }, [retales, busqueda]);

  const resumenRetales = useMemo(() => {
    const disponibles = retales.filter((retal) => retal.disponible !== false);
    return {
      total: retales.length,
      disponibles: disponibles.length,
      piezas: disponibles.reduce((total, retal) => total + Number(retal.cantidad || 0), 0),
      metros:
        disponibles.reduce(
          (total, retal) => total + (Number(retal.largo_cm || 0) * Number(retal.cantidad || 1)) / 100,
          0,
        ),
    };
  }, [retales]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Inventario de Producción</h1>
          <p className="text-xs text-slate-400 mt-1">
            Insumos, consumibles y materiales propios del taller por colaborador.
            {resumen.criticos > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-400 font-semibold">
                <AlertTriangle size={12} /> {resumen.criticos} en nivel crítico
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {permisos.puedeInventarioProduccion && vista === 'insumos' && (
            <button
              type="button"
              onClick={abrirNuevo}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} /> Agregar insumo
            </button>
          )}
          {permisos.puedeInventarioProduccion && vista === 'retales' && retalesDisponibles && (
            <button
              type="button"
              onClick={abrirNuevoRetal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus size={16} /> Registrar retal
            </button>
          )}
        </div>
      </div>

      <div className="inline-flex bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1">
        {[
          { valor: 'insumos', etiqueta: 'Insumos del taller', icono: Boxes },
          { valor: 'retales', etiqueta: 'Retales de perfil', icono: Recycle },
        ].map(({ valor, etiqueta, icono: Icono }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setVista(valor)}
            aria-pressed={vista === valor}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              vista === valor
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Icono size={14} /> {etiqueta}
          </button>
        ))}
      </div>

      {vista === 'insumos' ? (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { etiqueta: 'Insumos registrados', valor: resumen.total, color: 'text-blue-400' },
          { etiqueta: 'Nivel crítico', valor: resumen.criticos, color: 'text-red-400' },
          { etiqueta: 'A mi cargo', valor: resumen.propios, color: 'text-emerald-400' },
        ].map((item) => (
          <div
            key={item.etiqueta}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between"
          >
            <span className="text-[11px] text-slate-400 font-medium">{item.etiqueta}</span>
            <span className={`text-lg font-black font-mono ${item.color}`}>
              {cargando ? '…' : item.valor}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por insumo, ubicación, nota o colaborador..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" size={16} />
          <select
            value={filtroCategoria}
            onChange={(evento) => setFiltroCategoria(evento.target.value)}
            aria-label="Filtrar por categoría"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none"
          >
            <option value="TODAS">Todas las categorías</option>
            {CATEGORIAS_INVENTARIO_PRODUCCION.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <User className="absolute left-3.5 top-3 text-slate-500 pointer-events-none" size={16} />
          <select
            value={filtroColaborador}
            onChange={(evento) => setFiltroColaborador(evento.target.value)}
            aria-label="Filtrar por colaborador"
            disabled={esSoloProduccion}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 appearance-none disabled:opacity-60"
          >
            <option value="TODOS">Todos los colaboradores</option>
            <option value="SIN_ASIGNAR">Sin asignar</option>
            {colaboradores.map((colaborador) => (
              <option key={colaborador.id} value={colaborador.id}>
                {colaborador.nombre_completo}
              </option>
            ))}
          </select>
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
            onClick={refrescar}
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
                <th className="p-4">Insumo</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4">A cargo</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    Cargando inventario de producción...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    {insumos.length === 0
                      ? 'No hay insumos registrados para producción.'
                      : 'Ningún insumo coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((insumo) => {
                  const bajo = stockBajo(insumo);
                  return (
                    <tr key={insumo.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                            <Boxes size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate">{insumo.nombre}</p>
                            <p className="text-[10px] text-slate-500 font-normal">
                              {insumo.notas || 'Sin notas'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{insumo.categoria}</td>
                      <td className="p-4 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${bajo ? 'text-red-400' : 'text-emerald-400'}`}>
                            {Number(insumo.stock_actual ?? 0)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {insumo.unidad_medida} / min {Number(insumo.stock_minimo ?? 0)}
                          </span>
                          {bajo && (
                            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                              <AlertTriangle size={12} /> Bajo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{insumo.ubicacion || '—'}</td>
                      <td className="p-4 text-slate-300">
                        {insumo.colaborador_nombre ? (
                          <>
                            <p className="inline-flex items-center gap-1">
                              <User size={11} /> {insumo.colaborador_nombre}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              {insumo.actualizado_en
                                ? `Actualizado ${formatFechaHora(insumo.actualizado_en)}`
                                : ''}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-500">Sin asignar</span>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {permisos.puedeInventarioProduccion && (
                            <>
                              <button
                                type="button"
                                onClick={() => ajustarStock(insumo, -1)}
                                title="Descontar una unidad"
                                aria-label={`Descontar una unidad de ${insumo.nombre}`}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-mono text-[11px]"
                              >
                                −1
                              </button>
                              <button
                                type="button"
                                onClick={() => ajustarStock(insumo, 1)}
                                title="Sumar una unidad"
                                aria-label={`Sumar una unidad a ${insumo.nombre}`}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-mono text-[11px]"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirEditar(insumo)}
                                title="Editar insumo"
                                aria-label={`Editar ${insumo.nombre}`}
                                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminar(insumo)}
                                title="Eliminar insumo"
                                aria-label={`Eliminar ${insumo.nombre}`}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <>
      {!retalesDisponibles && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-amber-950/60 border border-amber-500/40 text-amber-100 p-4 rounded-2xl text-xs"
        >
          <AlertTriangle size={18} className="shrink-0 text-amber-300 mt-0.5" />
          <p className="flex-1">
            Todavía no existe la tabla de retales. Ejecuta{' '}
            <strong>supabase/migrations/008_despiece_avanzado_retales.sql</strong> en el SQL Editor
            de Supabase y vuelve a cargar esta página.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { etiqueta: 'Retales registrados', valor: resumenRetales.total, color: 'text-blue-400' },
          {
            etiqueta: 'Disponibles',
            valor: resumenRetales.disponibles,
            color: 'text-emerald-400',
          },
          { etiqueta: 'Piezas en total', valor: resumenRetales.piezas, color: 'text-cyan-400' },
          {
            etiqueta: 'Metros disponibles',
            valor: `${resumenRetales.metros.toLocaleString('es-CO', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} m`,
            color: 'text-amber-400',
          },
        ].map((item) => (
          <div
            key={item.etiqueta}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between gap-2"
          >
            <span className="text-[11px] text-slate-400 font-medium">{item.etiqueta}</span>
            <span className={`text-lg font-black font-mono ${item.color}`}>{item.valor}</span>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar retal por material, color, código o ubicación..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Retal</th>
                <th className="p-4">Material</th>
                <th className="p-4">Color</th>
                <th className="p-4 text-right">Largo</th>
                <th className="p-4 text-right">Cantidad</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    Cargando retales...
                  </td>
                </tr>
              ) : retalesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-500">
                    {retales.length === 0
                      ? 'Todavía no hay retales registrados. Registra los sobrantes de producción para reutilizarlos.'
                      : 'Ningún retal coincide con la búsqueda.'}
                  </td>
                </tr>
              ) : (
                retalesFiltrados.map((retal) => (
                  <tr key={retal.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 shrink-0 rounded-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <Recycle size={16} />
                        </div>
                        <span>{retal.codigo || 'Sin código'}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-200">{retal.material_nombre}</td>
                    <td className="p-4 text-slate-300 whitespace-nowrap">{retal.color || '—'}</td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      {Number(retal.largo_cm || 0).toLocaleString('es-CO', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      cm
                    </td>
                    <td className="p-4 text-right font-mono text-slate-200">
                      {Number(retal.cantidad || 1)}
                    </td>
                    <td className="p-4 text-slate-300">{retal.ubicacion || '—'}</td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => alternarDisponible(retal)}
                        disabled={!permisos.puedeInventarioProduccion}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                          retal.disponible === false
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {retal.disponible === false ? 'No disponible' : 'Disponible'}
                      </button>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {permisos.puedeInventarioProduccion && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirEditarRetal(retal)}
                            title="Editar retal"
                            aria-label={`Editar retal ${retal.codigo || retal.material_nombre}`}
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarRetal(retal)}
                            title="Eliminar retal"
                            aria-label={`Eliminar retal ${retal.codigo || retal.material_nombre}`}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 flex items-start gap-2">
        <Ruler size={14} className="shrink-0 mt-0.5" />
        Los retales se consumen antes de pedir barras nuevas. Las barras de perfil miden{' '}
        {LARGO_BARRA_DEFECTO_CM} cm. El motor de despiece compara material, color y largo antes de
        reutilizar un retal.
      </p>
        </>
      )}

      <Modal
        abierto={modalAbierto}
        onClose={() => setModalAbierto(false)}
        icono={<Boxes size={20} />}
        titulo={insumoEditando ? 'Editar insumo de producción' : 'Nuevo insumo de producción'}
        subtitulo="Registra el insumo y el colaborador responsable de su control."
        ancho="max-w-lg"
      >
        <form onSubmit={guardar} className="space-y-4">
          {errorForm && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorForm}</span>
            </div>
          )}

          <div>
            <label htmlFor="prod-nombre" className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre del insumo <span className="text-red-400">*</span>
            </label>
            <input
              id="prod-nombre"
              type="text"
              value={form.nombre}
              onChange={(evento) => actualizarCampo('nombre', evento.target.value)}
              placeholder="Ej. Silicona neutra transparente"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="prod-categoria"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Categoría
              </label>
              <select
                id="prod-categoria"
                value={form.categoria}
                onChange={(evento) => actualizarCampo('categoria', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORIAS_INVENTARIO_PRODUCCION.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="prod-unidad"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Unidad
              </label>
              <select
                id="prod-unidad"
                value={form.unidadMedida}
                onChange={(evento) => actualizarCampo('unidadMedida', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {UNIDADES_MEDIDA.map((unidad) => (
                  <option key={unidad} value={unidad}>
                    {unidad}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="prod-stock"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Stock actual
              </label>
              <input
                id="prod-stock"
                type="number"
                min="0"
                step="any"
                value={form.stockActual}
                onChange={(evento) => actualizarCampo('stockActual', evento.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="prod-minimo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Stock mínimo
              </label>
              <input
                id="prod-minimo"
                type="number"
                min="0"
                step="any"
                value={form.stockMinimo}
                onChange={(evento) => actualizarCampo('stockMinimo', evento.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="prod-ubicacion"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Ubicación
              </label>
              <input
                id="prod-ubicacion"
                type="text"
                value={form.ubicacion}
                onChange={(evento) => actualizarCampo('ubicacion', evento.target.value)}
                placeholder="Ej. Estante A3"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="prod-colaborador"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Colaborador a cargo
              </label>
              <select
                id="prod-colaborador"
                value={form.colaboradorId}
                onChange={(evento) => actualizarCampo('colaboradorId', evento.target.value)}
                disabled={esSoloProduccion}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
              >
                <option value="">Sin asignar</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre_completo} · {colaborador.rol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prod-notas" className="block text-xs font-semibold text-slate-300 mb-1">
              Notas
            </label>
            <textarea
              id="prod-notas"
              rows="2"
              value={form.notas}
              onChange={(evento) => actualizarCampo('notas', evento.target.value)}
              placeholder="Ej. Marca, presentación, proveedor..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalAbierto(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar insumo'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={modalRetal}
        onClose={() => setModalRetal(false)}
        icono={<Recycle size={20} />}
        titulo={retalEditando ? 'Editar retal de producción' : 'Nuevo retal de producción'}
        subtitulo="Registra los sobrantes de perfil para que el despiece los reutilice antes de pedir barras nuevas."
        ancho="max-w-lg"
      >
        <form onSubmit={guardarRetal} className="space-y-4">
          {errorRetal && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorRetal}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="retal-codigo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Código o etiqueta
              </label>
              <input
                id="retal-codigo"
                type="text"
                value={formRetal.codigo}
                onChange={(evento) => actualizarCampoRetal('codigo', evento.target.value)}
                placeholder="Ej. R-001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="retal-material"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Material <span className="text-red-400">*</span>
              </label>
              <input
                id="retal-material"
                type="text"
                value={formRetal.materialNombre}
                onChange={(evento) => actualizarCampoRetal('materialNombre', evento.target.value)}
                placeholder="Ej. Jamba 50/20"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="retal-color"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Color
              </label>
              <select
                id="retal-color"
                value={formRetal.color}
                onChange={(evento) => actualizarCampoRetal('color', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {COLORES_RETAL.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="retal-largo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Largo (cm) <span className="text-red-400">*</span>
              </label>
              <input
                id="retal-largo"
                type="number"
                min="0.1"
                step="0.1"
                value={formRetal.largo}
                onChange={(evento) => actualizarCampoRetal('largo', evento.target.value)}
                placeholder="Ej. 180.5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="retal-ancho"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Ancho (cm, opcional)
              </label>
              <input
                id="retal-ancho"
                type="number"
                min="0"
                step="0.1"
                value={formRetal.ancho}
                onChange={(evento) => actualizarCampoRetal('ancho', evento.target.value)}
                placeholder="Ej. 4"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="retal-cantidad"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Cantidad de retales iguales
              </label>
              <input
                id="retal-cantidad"
                type="number"
                min="1"
                step="1"
                value={formRetal.cantidad}
                onChange={(evento) => actualizarCampoRetal('cantidad', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="retal-ubicacion"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Ubicación
              </label>
              <input
                id="retal-ubicacion"
                type="text"
                value={formRetal.ubicacion}
                onChange={(evento) => actualizarCampoRetal('ubicacion', evento.target.value)}
                placeholder="Ej. Rack de sobrantes, puesto 2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="retal-notas" className="block text-xs font-semibold text-slate-300 mb-1">
              Notas
            </label>
            <textarea
              id="retal-notas"
              rows="2"
              value={formRetal.notas}
              onChange={(evento) => actualizarCampoRetal('notas', evento.target.value)}
              placeholder="Ej. Retal de la orden OT-000123, sin defectos."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={formRetal.disponible}
              onChange={(evento) => actualizarCampoRetal('disponible', evento.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500"
            />
            Disponible para reutilizar en el despiece
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalRetal(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoRetal}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-colors"
            >
              {guardandoRetal ? 'Guardando...' : 'Guardar retal'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
