import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Edit2, Phone, Plus, RefreshCw, Search, UserRound } from 'lucide-react';

import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';
import Modal from '../components/Modal';
import useToast from '../hooks/useToast';

const VACIO = { nombre: '', telefono: '', direccion: '', barrio: '', notas: '', activo: true };

export default function Clientes({ perfil }) {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [recarga, setRecarga] = useState(0);
  const { alerta, mostrar, cerrar } = useToast();

  const cargar = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });
    if (errorConsulta) throw errorConsulta;
    setClientes(data ?? []);
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        setCargando(true);
        const { data, error: errorConsulta } = await supabase
          .from('clientes')
          .select('*')
          .order('nombre', { ascending: true });
        if (!activo) return;
        if (errorConsulta) throw errorConsulta;
        setClientes(data ?? []);
        setError('');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar los clientes.');
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [recarga]);

  const filtrados = useMemo(() => {
    const texto = busqueda.toLocaleLowerCase().trim();
    if (!texto) return clientes;
    return clientes.filter((cliente) =>
      [cliente.nombre, cliente.telefono, cliente.direccion, cliente.barrio]
        .filter(Boolean)
        .some((valor) => String(valor).toLocaleLowerCase().includes(texto)),
    );
  }, [clientes, busqueda]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(VACIO);
    setErrorForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (cliente) => {
    setEditando(cliente);
    setForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || '',
      barrio: cliente.barrio || '',
      notas: cliente.notas || '',
      activo: cliente.activo !== false,
    });
    setErrorForm('');
    setModalAbierto(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const nombre = form.nombre.trim();
    if (!nombre) {
      setErrorForm('El nombre del cliente es obligatorio.');
      return;
    }
    setGuardando(true);
    setErrorForm('');
    try {
      const payload = {
        nombre,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        barrio: form.barrio.trim() || null,
        notas: form.notas.trim() || null,
        activo: form.activo,
        actualizado_en: new Date().toISOString(),
      };
      const respuesta = editando
        ? await supabase.from('clientes').update(payload).eq('id', editando.id)
        : await supabase.from('clientes').insert([payload]);
      if (respuesta.error) throw respuesta.error;
      setModalAbierto(false);
      await cargar();
      mostrar(editando ? 'Cliente actualizado' : 'Cliente creado', `${nombre} quedó guardado.`, 'exito');
    } catch (err) {
      setErrorForm(err.message || 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Clientes</h1>
          <p className="mt-1 text-xs text-slate-400">Directorio para reutilizar datos al crear órdenes.</p>
        </div>
        <button type="button" onClick={abrirNuevo} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500">
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">
          <AlertCircle size={16} /> <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setRecarga((v) => v + 1)}><RefreshCw size={14} /></button>
        </div>
      )}

      <div className="relative rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <Search className="absolute left-7 top-7 text-slate-500" size={16} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente por nombre, teléfono o dirección..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-xs text-white focus:border-blue-500 focus:outline-none" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
        {cargando ? (
          <p className="p-8 text-center text-xs text-slate-500">Cargando clientes...</p>
        ) : filtrados.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No hay clientes registrados.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {filtrados.map((cliente) => (
              <div key={cliente.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-center">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><UserRound size={16} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">{cliente.nombre}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{cliente.direccion || 'Sin dirección'}{cliente.barrio ? ` · ${cliente.barrio}` : ''}</p>
                  </div>
                </div>
                <p className="flex items-center gap-1 text-[11px] text-slate-300"><Phone size={12} /> {cliente.telefono || 'Sin teléfono'}</p>
                <button type="button" onClick={() => abrirEditar(cliente)} className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white" aria-label={`Editar ${cliente.nombre}`}><Edit2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal abierto={modalAbierto} onClose={() => setModalAbierto(false)} titulo={editando ? 'Editar cliente' : 'Nuevo cliente'} subtitulo="Datos reutilizables en las órdenes de trabajo." ancho="max-w-xl">
        <form onSubmit={guardar} className="space-y-3">
          {errorForm && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200">{errorForm}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['nombre', 'Nombre completo *', 'Ej. Juan Pérez'],
              ['telefono', 'Teléfono', 'Ej. 3110000000'],
              ['direccion', 'Dirección', 'Ej. Calle 25 # 4-32'],
              ['barrio', 'Barrio / sector', 'Ej. Centro'],
            ].map(([campo, etiqueta, placeholder]) => (
              <label key={campo} className="text-xs font-semibold text-slate-300">
                {etiqueta}
                <input value={form[campo]} onChange={(e) => setForm((prev) => ({ ...prev, [campo]: e.target.value }))} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
              </label>
            ))}
          </div>
          <label className="block text-xs font-semibold text-slate-300">Notas
            <textarea rows={3} value={form.notas} onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))} className="mt-1 w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-blue-500 focus:outline-none" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalAbierto(false)} className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300">Cancelar</button>
            <button type="submit" disabled={guardando} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{guardando ? 'Guardando...' : 'Guardar cliente'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
