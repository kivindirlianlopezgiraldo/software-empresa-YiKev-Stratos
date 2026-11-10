import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Edit2,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { CATEGORIAS_INVENTARIO, UNIDADES_MEDIDA } from '../lib/constants';
import { formatCOP, formatMiles, nuevoId, parseCOP } from '../lib/format';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import useToast from '../hooks/useToast';
import useConfirm from '../hooks/useConfirm';

const FORM_VACIO = {
  codigoReferencia: '',
  nombre: '',
  categoria: CATEGORIAS_INVENTARIO[0],
  unidadMedida: UNIDADES_MEDIDA[0],
  stockActual: '',
  stockMinimo: '',
  precioCosto: '',
  precioVenta: '',
  proveedorId: '',
};

export default function Inventario({ permisos }) {
  const [materiales, setMateriales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { alerta, mostrar, cerrar } = useToast();
  const confirmar = useConfirm();
  const puedeEditar = permisos ? permisos.puedeEditarInventario : true;

  const consultarInventario = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from('inventario_materiales')
      .select('*')
      .order('nombre', { ascending: true });

    if (errorConsulta) throw errorConsulta;
    return data ?? [];
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const filas = await consultarInventario();
        if (!activo) return;
        setMateriales(filas);
        setError('');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudo cargar el inventario.');
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarInventario, recarga]);

  const reintentar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const refrescar = () => setRecarga((valor) => valor + 1);

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const abrirNuevo = () => {
    setMaterialEditando(null);
    setForm(FORM_VACIO);
    setErrorForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (material) => {
    setMaterialEditando(material);
    setForm({
      codigoReferencia: material.codigo_referencia || '',
      nombre: material.nombre || '',
      categoria: material.categoria || CATEGORIAS_INVENTARIO[0],
      unidadMedida: material.unidad_medida || UNIDADES_MEDIDA[0],
      stockActual: material.stock_actual !== null ? String(material.stock_actual) : '',
      stockMinimo: material.stock_minimo !== null ? String(material.stock_minimo) : '',
      precioCosto: material.precio_costo ? formatMiles(material.precio_costo) : '',
      precioVenta: material.precio_venta ? formatMiles(material.precio_venta) : '',
      proveedorId: material.proveedor_id || '',
    });
    setErrorForm('');
    setModalAbierto(true);
  };

  const handleGuardarMaterial = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorForm('');

    try {
      const nombre = form.nombre.trim();
      if (!nombre) throw new Error('El nombre del material es obligatorio.');

      const payload = {
        codigo_referencia: form.codigoReferencia.trim() || null,
        nombre,
        categoria: form.categoria,
        unidad_medida: form.unidadMedida,
        stock_actual: parseFloat(form.stockActual) || 0,
        stock_minimo: parseFloat(form.stockMinimo) || 0,
        precio_costo: parseCOP(form.precioCosto),
        precio_venta: parseCOP(form.precioVenta),
        proveedor_id: form.proveedorId.trim() || null,
      };

      if (materialEditando) {
        const { error: errorUpdate } = await supabase
          .from('inventario_materiales')
          .update(payload)
          .eq('id', materialEditando.id);
        if (errorUpdate) throw errorUpdate;
        mostrar('¡Actualización Exitosa!', 'Los datos del material fueron actualizados.', 'exito');
      } else {
        const { error: errorInsert } = await supabase
          .from('inventario_materiales')
          .insert([{ id: nuevoId(), ...payload }]);
        if (errorInsert) throw errorInsert;
        mostrar('¡Registro Exitoso!', 'El material fue agregado al inventario.', 'exito');
      }

      setModalAbierto(false);
      refrescar();
    } catch (err) {
      setErrorForm(err.message || 'Error al procesar los datos en el servidor.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarMaterial = async (material) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar material',
      mensaje: `¿Deseas eliminar permanentemente el material "${material.nombre}"?`,
      confirmarTexto: 'Eliminar material',
    });
    if (!confirmado) return;

    try {
      const { error: errorDelete } = await supabase
        .from('inventario_materiales')
        .delete()
        .eq('id', material.id);
      if (errorDelete) throw errorDelete;
      mostrar('Material Eliminado', `Se eliminó "${material.nombre}" del inventario.`, 'exito');
      refrescar();
    } catch (err) {
      mostrar('Error al eliminar', err.message);
    }
  };

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return materiales.filter((material) => {
      const coincideCategoria =
        filtroCategoria === 'TODAS' || material.categoria === filtroCategoria;
      if (!coincideCategoria) return false;
      if (!texto) return true;
      return [material.nombre, material.codigo_referencia]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto));
    });
  }, [materiales, busqueda, filtroCategoria]);

  const agotados = useMemo(
    () =>
      materiales.filter((m) => Number(m.stock_actual) <= Number(m.stock_minimo || 0)).length,
    [materiales],
  );

  const stockBajoPorMaterial = (material) =>
    Number(material.stock_actual) <= Number(material.stock_minimo || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Inventario de Materiales</h1>
          <p className="text-xs text-slate-400 mt-1">
            Perfiles, vidrios, acrílicos, accesorios y alertas de stock bajo.
            {agotados > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-400 font-semibold">
                <AlertTriangle size={12} /> {agotados} en nivel crítico
              </span>
            )}
          </p>
        </div>
        {puedeEditar && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} /> Agregar Material
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre o código de referencia..."
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
            {CATEGORIAS_INVENTARIO.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
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
                <th className="p-4">Código / Material</th>
                <th className="p-4">Categoría</th>
                <th className="p-4">Medida</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Costo</th>
                <th className="p-4">Venta</th>
                {puedeEditar && <th className="p-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan={puedeEditar ? 7 : 6} className="text-center py-8 text-slate-500">
                    Cargando materiales...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={puedeEditar ? 7 : 6} className="text-center py-8 text-slate-500">
                    {materiales.length === 0
                      ? 'No hay materiales registrados.'
                      : 'Ningún material coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((material) => {
                  const bajo = stockBajoPorMaterial(material);
                  return (
                    <tr key={material.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Package size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate">{material.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono font-normal">
                              {material.codigo_referencia || 'Sin código'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{material.categoria}</td>
                      <td className="p-4 text-slate-300 whitespace-nowrap">
                        {material.unidad_medida}
                      </td>
                      <td className="p-4 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${bajo ? 'text-red-400' : 'text-emerald-400'}`}>
                            {material.stock_actual}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            / min {material.stock_minimo ?? 0}
                          </span>
                          {bajo && (
                            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md">
                              <AlertTriangle size={12} /> Bajo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-300 whitespace-nowrap">
                        {formatCOP(material.precio_costo)}
                      </td>
                      <td className="p-4 font-mono text-emerald-400 font-bold whitespace-nowrap">
                        {formatCOP(material.precio_venta)}
                      </td>
                      {puedeEditar && (
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditar(material)}
                              title="Editar material"
                              aria-label={`Editar ${material.nombre}`}
                              className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarMaterial(material)}
                              title="Eliminar material"
                              aria-label={`Eliminar ${material.nombre}`}
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
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
        icono={<Package size={20} />}
        titulo={materialEditando ? 'Editar Material' : 'Agregar Nuevo Material'}
        subtitulo="Los precios se guardan en pesos colombianos (COP)."
        ancho="max-w-lg"
      >
        <form onSubmit={handleGuardarMaterial} className="space-y-4">
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
            <label htmlFor="material-nombre" className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre del Material / Perfil
            </label>
            <input
              id="material-nombre"
              type="text"
              value={form.nombre}
              onChange={(evento) => actualizarCampo('nombre', evento.target.value)}
              placeholder="Ej. Perfil Cabezal 3 Pulgadas Blanco"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="material-codigo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Código o Referencia
              </label>
              <input
                id="material-codigo"
                type="text"
                value={form.codigoReferencia}
                onChange={(evento) => actualizarCampo('codigoReferencia', evento.target.value)}
                placeholder="Ej. ALU-CAB-3IN"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="material-categoria"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Categoría
              </label>
              <select
                id="material-categoria"
                value={form.categoria}
                onChange={(evento) => actualizarCampo('categoria', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORIAS_INVENTARIO.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="material-unidad"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Unidad
              </label>
              <select
                id="material-unidad"
                value={form.unidadMedida}
                onChange={(evento) => actualizarCampo('unidadMedida', evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
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
                htmlFor="material-stock"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Stock Actual
              </label>
              <input
                id="material-stock"
                type="number"
                step="any"
                min="0"
                value={form.stockActual}
                onChange={(evento) => actualizarCampo('stockActual', evento.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="material-minimo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Stock Mínimo
              </label>
              <input
                id="material-minimo"
                type="number"
                step="any"
                min="0"
                value={form.stockMinimo}
                onChange={(evento) => actualizarCampo('stockMinimo', evento.target.value)}
                placeholder="5"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="material-costo"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Precio Costo (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  id="material-costo"
                  type="text"
                  inputMode="numeric"
                  value={form.precioCosto}
                  onChange={(evento) => {
                    const numero = parseCOP(evento.target.value);
                    actualizarCampo('precioCosto', numero ? formatMiles(numero) : '');
                  }}
                  placeholder="45.000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="material-venta"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Precio Venta (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  id="material-venta"
                  type="text"
                  inputMode="numeric"
                  value={form.precioVenta}
                  onChange={(evento) => {
                    const numero = parseCOP(evento.target.value);
                    actualizarCampo('precioVenta', numero ? formatMiles(numero) : '');
                  }}
                  placeholder="65.000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
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
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : materialEditando ? 'Actualizar Material' : 'Guardar Material'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
