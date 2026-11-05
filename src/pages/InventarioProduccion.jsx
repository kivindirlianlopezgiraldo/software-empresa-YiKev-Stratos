import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Edit2,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  CATEGORIAS_INVENTARIO_PRODUCCION,
  UNIDADES_MEDIDA,
  permisosDe,
} from '../lib/constants';
import { formatFechaHora, nuevoId } from '../lib/format';

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

function explicarError(err) {
  const texto = err?.message || '';
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

  const { alerta, mostrar, cerrar } = useToast();

  const consultar = useCallback(async () => {
    const [resInsumos, resColaboradores] = await Promise.all([
      supabase
        .from('inventario_produccion')
        .select('*')
        .order('nombre', { ascending: true }),
      supabase
        .from('perfiles_usuario')
        .select('id, nombre_completo, rol, activo')
        .order('nombre_completo', { ascending: true }),
    ]);

    if (resInsumos.error) throw resInsumos.error;

    return {
      insumos: resInsumos.data ?? [],
      colaboradores: resColaboradores.error ? [] : resColaboradores.data ?? [],
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
        {permisos.puedeInventarioProduccion && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} /> Agregar insumo
          </button>
        )}
      </div>

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
    </div>
  );
}
