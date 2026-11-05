import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  Images,
  LayoutTemplate,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { CATEGORIAS_PROYECTO } from '../lib/constants';
import { nuevoId } from '../lib/format';
import {
  MAX_IMAGENES_PROYECTO,
  eliminarImagenesProyecto,
  normalizarImagenesProyecto,
  subirImagenProyecto,
  urlImagenProyecto,
  validarImagenProyecto,
} from '../lib/proyectos';

import Modal from '../components/Modal';
import Toast from '../components/Toast';
import useToast from '../hooks/useToast';

const PROYECTO_VACIO = {
  id: '',
  titulo: '',
  categoria: 'Aluminio',
  cliente: '',
  ubicacion: 'Quibdó, Chocó',
  anio: new Date().getFullYear(),
  descripcion: '',
  materiales: '',
  imagenes: [],
  destacado: false,
  publicado: true,
  orden: 0,
};

const LANDING_VACIA = {
  hero_etiqueta: '',
  hero_titulo: '',
  hero_destacado: '',
  hero_texto: '',
  hero_beneficios: '',
  nosotros_titulo: '',
  nosotros_texto: '',
  proyectos_titulo: '',
  proyectos_texto: '',
  mostrar_proyectos: true,
  proyectos_limite: 6,
  contacto_titulo: '',
  contacto_texto: '',
  whatsapp_mensaje: '',
  actualizado_en: null,
};

const CAMPOS_LANDING = Object.keys(LANDING_VACIA).filter(
  (campo) => campo !== 'actualizado_en',
);

const claseInput =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500';

const claseBotonSecundario =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-700 hover:text-white disabled:opacity-50';

function Campo({ id, etiqueta, ayuda, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-300 mb-1">
        {etiqueta}
      </label>
      {children}
      {ayuda && <p className="text-[10px] text-slate-500 mt-1">{ayuda}</p>}
    </div>
  );
}

function Tarjeta({ icono, titulo, descripcion, children }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-start gap-3 border-b border-slate-800 pb-3">
        <span className="text-blue-500 mt-0.5 shrink-0">{icono}</span>
        <div>
          <h2 className="text-sm font-bold text-white">{titulo}</h2>
          {descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{descripcion}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function normalizarProyecto(fila = {}) {
  return {
    ...PROYECTO_VACIO,
    ...fila,
    titulo: fila.titulo ?? '',
    categoria: fila.categoria ?? PROYECTO_VACIO.categoria,
    cliente: fila.cliente ?? '',
    ubicacion: fila.ubicacion ?? '',
    anio: fila.anio ?? PROYECTO_VACIO.anio,
    descripcion: fila.descripcion ?? '',
    materiales: fila.materiales ?? '',
    imagenes: normalizarImagenesProyecto(fila.imagenes),
    destacado: Boolean(fila.destacado),
    publicado: Boolean(fila.publicado),
    orden: Number(fila.orden) || 0,
  };
}

function normalizarLanding(fila = {}) {
  const normalizada = { ...LANDING_VACIA };
  CAMPOS_LANDING.forEach((campo) => {
    const valor = fila[campo];
    if (valor === null || valor === undefined) return;
    normalizada[campo] = valor;
  });
  // En la base se puede guardar con "|" o con saltos de línea.
  normalizada.hero_beneficios = String(normalizada.hero_beneficios ?? '').replace(/\|/g, '\n');
  normalizada.actualizado_en = fila.actualizado_en ?? null;
  return normalizada;
}

export default function SitioWeb({ perfil }) {
  const [seccion, setSeccion] = useState('proyectos');
  const [proyectos, setProyectos] = useState([]);
  const [landing, setLanding] = useState(LANDING_VACIA);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [guardandoLanding, setGuardandoLanding] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [proyectoEnEdicion, setProyectoEnEdicion] = useState(false);
  const [proyectoForm, setProyectoForm] = useState(PROYECTO_VACIO);
  const [imagenesOriginales, setImagenesOriginales] = useState([]);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const { alerta, mostrar, cerrar } = useToast();

  const cargarTodo = useCallback(async () => {
    const [respuestaProyectos, respuestaLanding] = await Promise.all([
      supabase
        .from('proyectos')
        .select('*')
        .order('destacado', { ascending: false })
        .order('orden', { ascending: true })
        .order('creado_en', { ascending: false }),
      supabase.from('landing_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (respuestaProyectos.error) throw respuestaProyectos.error;
    if (respuestaLanding.error) throw respuestaLanding.error;

    return {
      proyectos: (respuestaProyectos.data || []).map(normalizarProyecto),
      landing: respuestaLanding.data ? normalizarLanding(respuestaLanding.data) : LANDING_VACIA,
    };
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const datos = await cargarTodo();
        if (!activo) return;
        setProyectos(datos.proyectos);
        setLanding(datos.landing);
        setError('');
      } catch (err) {
        if (!activo) return;
        const mensaje = err.message || 'No se pudo cargar el contenido del sitio web.';
        setError(
          /proyectos|landing_config|does not exist|no existe|schema cache/i.test(mensaje)
            ? `${mensaje} — Falta aplicar la migración 004_proyectos_landing.sql en Supabase.`
            : mensaje,
        );
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [cargarTodo, recarga]);

  const recargar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const abrirNuevo = () => {
    setProyectoForm({ ...PROYECTO_VACIO, id: nuevoId(), publicado: true });
    setProyectoEnEdicion(false);
    setImagenesOriginales([]);
    setErrorForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (proyecto) => {
    setProyectoForm({ ...proyecto, imagenes: [...proyecto.imagenes] });
    setProyectoEnEdicion(true);
    setImagenesOriginales([...proyecto.imagenes]);
    setErrorForm('');
    setModalAbierto(true);
  };

  const actualizarProyecto = (campo, valor) => {
    setProyectoForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const descartarSubidasNuevas = async () => {
    const originales = new Set(imagenesOriginales);
    const nuevas = proyectoForm.imagenes.filter((ruta) => !originales.has(ruta));
    await eliminarImagenesProyecto(nuevas);
  };

  const cerrarModal = async () => {
    if (subiendo) return;
    await descartarSubidasNuevas();
    setModalAbierto(false);
    setErrorForm('');
  };

  const subirArchivos = async (evento) => {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (!archivos.length) return;

    const disponibles = MAX_IMAGENES_PROYECTO - proyectoForm.imagenes.length;
    if (disponibles <= 0) {
      setErrorForm(`Un proyecto puede tener máximo ${MAX_IMAGENES_PROYECTO} fotos.`);
      return;
    }

    const seleccionados = archivos.slice(0, disponibles);
    for (const archivo of seleccionados) {
      const errorValidacion = validarImagenProyecto(archivo);
      if (errorValidacion) {
        setErrorForm(errorValidacion);
        return;
      }
    }

    setSubiendo(true);
    setErrorForm('');
    const subidas = [];

    try {
      for (const archivo of seleccionados) {
        const ruta = await subirImagenProyecto(archivo, proyectoForm.id);
        subidas.push(ruta);
      }

      setProyectoForm((prev) => ({
        ...prev,
        imagenes: [...prev.imagenes, ...subidas].slice(0, MAX_IMAGENES_PROYECTO),
      }));
    } catch (err) {
      if (subidas.length) await eliminarImagenesProyecto(subidas);
      setErrorForm(err.message || 'No se pudieron subir las fotos.');
    } finally {
      setSubiendo(false);
    }
  };

  const quitarImagen = (indice) => {
    const ruta = proyectoForm.imagenes[indice];
    setProyectoForm((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((_, posicion) => posicion !== indice),
    }));

    // Si la foto se subió en esta sesión, se borra de inmediato para no dejar
    // archivos huérfanos en el bucket.
    if (ruta && !imagenesOriginales.includes(ruta)) {
      eliminarImagenesProyecto([ruta]);
    }
  };

  const usarComoPortada = (indice) => {
    if (indice === 0) return;
    setProyectoForm((prev) => {
      const imagenes = [...prev.imagenes];
      const [elegida] = imagenes.splice(indice, 1);
      return { ...prev, imagenes: [elegida, ...imagenes] };
    });
  };

  const guardarProyecto = async (evento) => {
    evento.preventDefault();
    setGuardandoProyecto(true);
    setErrorForm('');

    try {
      const titulo = proyectoForm.titulo.trim();
      if (!titulo) throw new Error('El título del proyecto es obligatorio.');

      const anio = proyectoForm.anio === '' || proyectoForm.anio === null
        ? null
        : Number(proyectoForm.anio);
      if (anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > 2100)) {
        throw new Error('El año del proyecto debe estar entre 1900 y 2100.');
      }

      const orden = Number(proyectoForm.orden) || 0;

      const payload = {
        id: proyectoForm.id,
        titulo,
        categoria: proyectoForm.categoria || 'Aluminio',
        cliente: proyectoForm.cliente.trim(),
        ubicacion: proyectoForm.ubicacion.trim(),
        anio,
        descripcion: proyectoForm.descripcion.trim(),
        materiales: proyectoForm.materiales.trim(),
        imagenes: proyectoForm.imagenes,
        destacado: Boolean(proyectoForm.destacado),
        publicado: Boolean(proyectoForm.publicado),
        orden,
        actualizado_por: perfil?.nombre_completo || 'Administrador',
      };

      const { error: errorGuardado } = await supabase.from('proyectos').upsert(payload);
      if (errorGuardado) throw errorGuardado;

      const quitadas = imagenesOriginales.filter(
        (ruta) => !proyectoForm.imagenes.includes(ruta),
      );
      await eliminarImagenesProyecto(quitadas);

      mostrar(
        'Proyecto guardado',
        proyectoForm.publicado
          ? 'El proyecto ya está visible en la landing.'
          : 'El proyecto quedó guardado como borrador.',
        'exito',
      );
      setModalAbierto(false);
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorForm(err.message || 'No se pudo guardar el proyecto.');
    } finally {
      setGuardandoProyecto(false);
    }
  };

  const alternarCampo = async (proyecto, campo) => {
    const nuevoValor = !proyecto[campo];

    const { error: errorCambio } = await supabase
      .from('proyectos')
      .update({ [campo]: nuevoValor, actualizado_por: perfil?.nombre_completo || 'Administrador' })
      .eq('id', proyecto.id);

    if (errorCambio) {
      mostrar('No se pudo actualizar', errorCambio.message, 'error');
      return;
    }

    setProyectos((prev) =>
      prev.map((item) => (item.id === proyecto.id ? { ...item, [campo]: nuevoValor } : item)),
    );
    mostrar(
      campo === 'publicado'
        ? nuevoValor
          ? 'Proyecto publicado'
          : 'Proyecto oculto'
        : nuevoValor
          ? 'Proyecto destacado'
          : 'Proyecto sin destacar',
      campo === 'publicado'
        ? nuevoValor
          ? 'Ya aparece en la sección de proyectos de la landing.'
          : 'Dejó de mostrarse en la landing pública.'
        : 'El orden de la landing se actualizó.',
      'exito',
    );
  };

  const eliminarProyecto = async (proyecto) => {
    const confirmado = window.confirm(
      `¿Eliminar el proyecto “${proyecto.titulo}”? También se borrarán sus fotos del portafolio.`,
    );
    if (!confirmado) return;

    const { error: errorBorrado } = await supabase
      .from('proyectos')
      .delete()
      .eq('id', proyecto.id);

    if (errorBorrado) {
      mostrar('No se pudo eliminar', errorBorrado.message, 'error');
      return;
    }

    await eliminarImagenesProyecto(proyecto.imagenes);
    setProyectos((prev) => prev.filter((item) => item.id !== proyecto.id));
    mostrar('Proyecto eliminado', 'El proyecto y sus fotos se borraron.', 'exito');
  };

  const actualizarLanding = (campo, valor) => {
    setLanding((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardarLanding = async (evento) => {
    evento.preventDefault();
    setGuardandoLanding(true);

    try {
      const limite = Number(landing.proyectos_limite) || 6;
      if (limite < 1 || limite > 24) {
        throw new Error('El número de proyectos visibles debe estar entre 1 y 24.');
      }

      const payload = { id: 1 };
      CAMPOS_LANDING.forEach((campo) => {
        if (campo === 'mostrar_proyectos') {
          payload[campo] = Boolean(landing[campo]);
        } else if (campo === 'proyectos_limite') {
          payload[campo] = limite;
        } else {
          payload[campo] = String(landing[campo] ?? '').trim();
        }
      });
      payload.actualizado_por = perfil?.nombre_completo || 'Administrador';

      const { error: errorGuardado } = await supabase.from('landing_config').upsert(payload);
      if (errorGuardado) throw errorGuardado;

      mostrar(
        'Sitio actualizado',
        'Los textos de la landing se guardaron correctamente.',
        'exito',
      );
      setRecarga((valor) => valor + 1);
    } catch (err) {
      mostrar('No se pudo guardar', err.message || 'Revisa los textos e intenta de nuevo.', 'error');
    } finally {
      setGuardandoLanding(false);
    }
  };

  const proyectosFiltrados = proyectos.filter((proyecto) => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return true;
    return [proyecto.titulo, proyecto.cliente, proyecto.categoria, proyecto.ubicacion]
      .filter(Boolean)
      .some((valor) => String(valor).toLowerCase().includes(texto));
  });

  const publicados = proyectos.filter((proyecto) => proyecto.publicado).length;
  const destacados = proyectos.filter((proyecto) => proyecto.destacado).length;

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
        Cargando contenido del sitio web...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      {/* Cabecera */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Globe size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-white truncate">Sitio web y proyectos</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Publica trabajos realizados y actualiza los textos de la landing.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={recargar} className={claseBotonSecundario}>
            <RefreshCw size={14} /> Recargar
          </button>
          <button
            type="button"
            onClick={abrirNuevo}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500"
          >
            <Plus size={15} /> Nuevo proyecto
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-red-950/60 border border-red-500/40 text-red-200 p-4 rounded-2xl text-xs"
        >
          <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <p className="flex-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={recargar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg font-semibold shrink-0"
          >
            <RefreshCw size={14} /> Reintentar
          </button>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { etiqueta: 'Proyectos', valor: proyectos.length, Icono: Images },
          { etiqueta: 'Publicados', valor: publicados, Icono: Eye },
          { etiqueta: 'Destacados', valor: destacados, Icono: Star },
          {
            etiqueta: 'En la landing',
            valor: landing.mostrar_proyectos ? 'Sí' : 'No',
            Icono: Globe,
          },
        ].map(({ etiqueta, valor, Icono }) => (
          <div key={etiqueta} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {etiqueta}
            </p>
            <p className="text-lg font-black text-white mt-1 flex items-center gap-2">
              <Icono size={16} className="text-blue-400" /> {valor}
            </p>
          </div>
        ))}
      </div>

      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSeccion('proyectos')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
            seccion === 'proyectos'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <Images size={15} /> Proyectos realizados
        </button>
        <button
          type="button"
          onClick={() => setSeccion('textos')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
            seccion === 'textos'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }`}
        >
          <LayoutTemplate size={15} /> Textos de la landing
        </button>
      </div>

      {seccion === 'proyectos' ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar por título, cliente o categoría..."
              aria-label="Buscar proyectos"
              className={`${claseInput} sm:max-w-xs`}
            />
            <p className="text-[11px] text-slate-500">
              El orden menor aparece primero. Los destacados van al inicio.
            </p>
          </div>

          {proyectos.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ImagePlus size={26} />
              </div>
              <h2 className="text-sm font-bold text-white">Aún no hay proyectos publicados</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Sube fotos de trabajos terminados, agrega la información de cada obra y publícalos
                para que aparezcan en la sección de proyectos de la landing.
              </p>
              <button
                type="button"
                onClick={abrirNuevo}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500"
              >
                <Plus size={15} /> Crear el primer proyecto
              </button>
            </div>
          ) : proyectosFiltrados.length === 0 ? (
            <p className="text-center text-xs text-slate-500 py-10">
              No hay proyectos que coincidan con “{busqueda}”.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {proyectosFiltrados.map((proyecto) => {
                const portada = urlImagenProyecto(proyecto.imagenes[0]);
                return (
                  <article
                    key={proyecto.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col"
                  >
                    <div className="relative h-44 bg-slate-950">
                      {portada ? (
                        <img
                          src={portada}
                          alt={proyecto.titulo}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-slate-700">
                          <ImagePlus size={38} />
                        </div>
                      )}

                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider backdrop-blur ${
                            proyecto.publicado
                              ? 'border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                              : 'border-amber-400/30 bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {proyecto.publicado ? 'Publicado' : 'Borrador'}
                        </span>
                        {proyecto.destacado && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/20 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-100 backdrop-blur">
                            <Star size={9} /> Destacado
                          </span>
                        )}
                      </div>

                      {proyecto.imagenes.length > 1 && (
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-slate-950/70 px-2.5 py-1 text-[9px] font-semibold text-slate-200 backdrop-blur">
                          <Images size={11} /> {proyecto.imagenes.length} fotos
                        </span>
                      )}
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                          {proyecto.categoria}
                        </p>
                        <h2 className="text-sm font-bold text-white mt-1">{proyecto.titulo}</h2>
                        {proyecto.descripcion && (
                          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">
                            {proyecto.descripcion}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        {proyecto.ubicacion && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} /> {proyecto.ubicacion}
                          </span>
                        )}
                        {proyecto.anio && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} /> {proyecto.anio}
                          </span>
                        )}
                        <span>Orden: {proyecto.orden}</span>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                        <button
                          type="button"
                          onClick={() => abrirEditar(proyecto)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[10px] font-semibold text-slate-300 hover:text-white"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarCampo(proyecto, 'publicado')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[10px] font-semibold text-slate-300 hover:text-white"
                        >
                          {proyecto.publicado ? <EyeOff size={12} /> : <Eye size={12} />}
                          {proyecto.publicado ? 'Ocultar' : 'Publicar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarCampo(proyecto, 'destacado')}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold ${
                            proyecto.destacado
                              ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
                          }`}
                        >
                          <Star size={12} /> {proyecto.destacado ? 'Quitar destacado' : 'Destacar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarProyecto(proyecto)}
                          aria-label={`Eliminar ${proyecto.titulo}`}
                          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-semibold text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={guardarLanding} className="space-y-6">
          <Tarjeta
            icono={<Globe size={18} />}
            titulo="Portada principal"
            descripcion="Es lo primero que ve un cliente cuando entra al sitio."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo id="landing-hero-etiqueta" etiqueta="Etiqueta superior">
                <input
                  id="landing-hero-etiqueta"
                  type="text"
                  value={landing.hero_etiqueta}
                  onChange={(evento) => actualizarLanding('hero_etiqueta', evento.target.value)}
                  className={claseInput}
                />
              </Campo>
              <Campo id="landing-hero-destacado" etiqueta="Texto resaltado">
                <input
                  id="landing-hero-destacado"
                  type="text"
                  value={landing.hero_destacado}
                  onChange={(evento) => actualizarLanding('hero_destacado', evento.target.value)}
                  className={claseInput}
                />
              </Campo>
              <Campo id="landing-hero-titulo" etiqueta="Título principal">
                <input
                  id="landing-hero-titulo"
                  type="text"
                  value={landing.hero_titulo}
                  onChange={(evento) => actualizarLanding('hero_titulo', evento.target.value)}
                  className={claseInput}
                />
              </Campo>
              <Campo
                id="landing-hero-beneficios"
                etiqueta="Beneficios de la portada"
                ayuda="Escribe uno por línea. Aparecen como checks debajo del botón."
              >
                <textarea
                  id="landing-hero-beneficios"
                  rows={3}
                  value={landing.hero_beneficios}
                  onChange={(evento) => actualizarLanding('hero_beneficios', evento.target.value)}
                  className={`${claseInput} resize-y`}
                />
              </Campo>
              <div className="sm:col-span-2">
                <Campo id="landing-hero-texto" etiqueta="Texto de presentación">
                  <textarea
                    id="landing-hero-texto"
                    rows={3}
                    value={landing.hero_texto}
                    onChange={(evento) => actualizarLanding('hero_texto', evento.target.value)}
                    className={`${claseInput} resize-y`}
                  />
                </Campo>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta
            icono={<LayoutTemplate size={18} />}
            titulo="Sección nosotros"
            descripcion="Presenta el taller y la forma de trabajar."
          >
            <div className="space-y-4">
              <Campo id="landing-nosotros-titulo" etiqueta="Título">
                <input
                  id="landing-nosotros-titulo"
                  type="text"
                  value={landing.nosotros_titulo}
                  onChange={(evento) => actualizarLanding('nosotros_titulo', evento.target.value)}
                  className={claseInput}
                />
              </Campo>
              <Campo id="landing-nosotros-texto" etiqueta="Texto">
                <textarea
                  id="landing-nosotros-texto"
                  rows={4}
                  value={landing.nosotros_texto}
                  onChange={(evento) => actualizarLanding('nosotros_texto', evento.target.value)}
                  className={`${claseInput} resize-y`}
                />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta
            icono={<Images size={18} />}
            titulo="Sección de proyectos"
            descripcion="Controla el título, la descripción y cuántos proyectos se muestran."
          >
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(landing.mostrar_proyectos)}
                  onChange={(evento) =>
                    actualizarLanding('mostrar_proyectos', evento.target.checked)
                  }
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-xs font-semibold text-white">
                    Mostrar la sección de proyectos
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-0.5">
                    Si la desactivas, la landing oculta el portafolio.
                  </span>
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo id="landing-proyectos-titulo" etiqueta="Título de la sección">
                  <input
                    id="landing-proyectos-titulo"
                    type="text"
                    value={landing.proyectos_titulo}
                    onChange={(evento) =>
                      actualizarLanding('proyectos_titulo', evento.target.value)
                    }
                    className={claseInput}
                  />
                </Campo>
                <Campo
                  id="landing-proyectos-limite"
                  etiqueta="Proyectos visibles"
                  ayuda="Entre 1 y 24."
                >
                  <input
                    id="landing-proyectos-limite"
                    type="number"
                    min={1}
                    max={24}
                    value={landing.proyectos_limite}
                    onChange={(evento) =>
                      actualizarLanding('proyectos_limite', evento.target.value)
                    }
                    className={claseInput}
                  />
                </Campo>
              </div>

              <Campo id="landing-proyectos-texto" etiqueta="Texto de la sección">
                <textarea
                  id="landing-proyectos-texto"
                  rows={3}
                  value={landing.proyectos_texto}
                  onChange={(evento) => actualizarLanding('proyectos_texto', evento.target.value)}
                  className={`${claseInput} resize-y`}
                />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta
            icono={<Upload size={18} />}
            titulo="Contacto y WhatsApp"
            descripcion="El botón de cotización abre WhatsApp con este mensaje."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo id="landing-contacto-titulo" etiqueta="Título del formulario">
                  <input
                    id="landing-contacto-titulo"
                    type="text"
                    value={landing.contacto_titulo}
                    onChange={(evento) => actualizarLanding('contacto_titulo', evento.target.value)}
                    className={claseInput}
                  />
                </Campo>
                <Campo id="landing-whatsapp" etiqueta="Mensaje inicial de WhatsApp">
                  <input
                    id="landing-whatsapp"
                    type="text"
                    value={landing.whatsapp_mensaje}
                    onChange={(evento) =>
                      actualizarLanding('whatsapp_mensaje', evento.target.value)
                    }
                    className={claseInput}
                  />
                </Campo>
              </div>
              <Campo id="landing-contacto-texto" etiqueta="Texto de contacto">
                <textarea
                  id="landing-contacto-texto"
                  rows={3}
                  value={landing.contacto_texto}
                  onChange={(evento) => actualizarLanding('contacto_texto', evento.target.value)}
                  className={`${claseInput} resize-y`}
                />
              </Campo>
            </div>
          </Tarjeta>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              {landing.actualizado_en
                ? `Última actualización: ${new Date(landing.actualizado_en).toLocaleString('es-CO')}`
                : 'Aún no se han guardado los textos de la landing.'}
            </p>
            <button
              type="submit"
              disabled={guardandoLanding}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              <Save size={16} />
              {guardandoLanding ? 'Guardando...' : 'Guardar textos'}
            </button>
          </div>
        </form>
      )}

      {/* Modal de proyecto */}
      <Modal
        abierto={modalAbierto}
        titulo={proyectoEnEdicion ? 'Editar proyecto' : 'Nuevo proyecto'}
        subtitulo="Las fotos se publican en el portafolio de la landing."
        icono={<Images size={20} />}
        onClose={cerrarModal}
        ancho="max-w-3xl"
      >
        <form onSubmit={guardarProyecto} className="space-y-5">
          {errorForm && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" />
              {errorForm}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Campo id="proyecto-titulo" etiqueta="Título del proyecto *">
                <input
                  id="proyecto-titulo"
                  type="text"
                  required
                  value={proyectoForm.titulo}
                  onChange={(evento) => actualizarProyecto('titulo', evento.target.value)}
                  placeholder="Ventanería Hotel Camino Real"
                  className={claseInput}
                />
              </Campo>
            </div>

            <Campo id="proyecto-categoria" etiqueta="Categoría">
              <select
                id="proyecto-categoria"
                value={proyectoForm.categoria}
                onChange={(evento) => actualizarProyecto('categoria', evento.target.value)}
                className={claseInput}
              >
                {CATEGORIAS_PROYECTO.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="proyecto-anio" etiqueta="Año de entrega">
              <input
                id="proyecto-anio"
                type="number"
                min={1900}
                max={2100}
                value={proyectoForm.anio}
                onChange={(evento) => actualizarProyecto('anio', evento.target.value)}
                className={claseInput}
              />
            </Campo>

            <Campo id="proyecto-cliente" etiqueta="Cliente">
              <input
                id="proyecto-cliente"
                type="text"
                value={proyectoForm.cliente}
                onChange={(evento) => actualizarProyecto('cliente', evento.target.value)}
                placeholder="Hotel Camino Real"
                className={claseInput}
              />
            </Campo>

            <Campo id="proyecto-ubicacion" etiqueta="Ubicación">
              <input
                id="proyecto-ubicacion"
                type="text"
                value={proyectoForm.ubicacion}
                onChange={(evento) => actualizarProyecto('ubicacion', evento.target.value)}
                placeholder="Quibdó, Chocó"
                className={claseInput}
              />
            </Campo>

            <div className="sm:col-span-2">
              <Campo id="proyecto-descripcion" etiqueta="Descripción">
                <textarea
                  id="proyecto-descripcion"
                  rows={3}
                  value={proyectoForm.descripcion}
                  onChange={(evento) => actualizarProyecto('descripcion', evento.target.value)}
                  placeholder="Qué se fabricó, cómo se resolvió el espacio y qué acabados se usaron."
                  className={`${claseInput} resize-y`}
                />
              </Campo>
            </div>

            <div className="sm:col-span-2">
              <Campo id="proyecto-materiales" etiqueta="Materiales y detalles">
                <input
                  id="proyecto-materiales"
                  type="text"
                  value={proyectoForm.materiales}
                  onChange={(evento) => actualizarProyecto('materiales', evento.target.value)}
                  placeholder="Aluminio línea 5020, vidrio claro 4 mm, mosquitero"
                  className={claseInput}
                />
              </Campo>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold text-slate-300">
                Fotos del proyecto ({proyectoForm.imagenes.length}/{MAX_IMAGENES_PROYECTO})
              </p>
              {subiendo && (
                <span className="inline-flex items-center gap-1.5 text-[10px] text-sky-300">
                  <Loader2 size={12} className="animate-spin" /> Subiendo...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {proyectoForm.imagenes.map((ruta, indice) => (
                <div
                  key={ruta}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
                >
                  <img
                    src={urlImagenProyecto(ruta)}
                    alt={`Foto ${indice + 1} del proyecto`}
                    className="h-full w-full object-cover"
                  />

                  {indice === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-blue-600/90 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                      Portada
                    </span>
                  )}

                  <div className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1">
                    {indice > 0 && (
                      <button
                        type="button"
                        onClick={() => usarComoPortada(indice)}
                        title="Usar como portada"
                        aria-label="Usar como portada"
                        className="rounded-lg bg-slate-950/80 p-1.5 text-slate-200 backdrop-blur hover:bg-blue-600 hover:text-white"
                      >
                        <Star size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => quitarImagen(indice)}
                      title="Quitar foto"
                      aria-label="Quitar foto"
                      className="ml-auto rounded-lg bg-slate-950/80 p-1.5 text-red-300 backdrop-blur hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {proyectoForm.imagenes.length < MAX_IMAGENES_PROYECTO && (
                <label
                  className={`aspect-[4/3] flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-950 text-slate-400 transition-colors hover:border-blue-500 hover:text-blue-300 ${
                    subiendo ? 'pointer-events-none opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <ImagePlus size={22} />
                  <span className="text-[10px] font-semibold">Agregar fotos</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={subiendo}
                    onChange={subirArchivos}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              JPG, PNG o WEBP · máximo 5 MB por foto. La primera imagen es la portada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Campo id="proyecto-orden" etiqueta="Orden" ayuda="Menor número aparece primero.">
              <input
                id="proyecto-orden"
                type="number"
                value={proyectoForm.orden}
                onChange={(evento) => actualizarProyecto('orden', evento.target.value)}
                className={claseInput}
              />
            </Campo>

            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-300 cursor-pointer sm:mt-5">
              <input
                type="checkbox"
                checked={Boolean(proyectoForm.publicado)}
                onChange={(evento) => actualizarProyecto('publicado', evento.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
              />
              Publicado en la landing
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-300 cursor-pointer sm:mt-5">
              <input
                type="checkbox"
                checked={Boolean(proyectoForm.destacado)}
                onChange={(evento) => actualizarProyecto('destacado', evento.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-600 focus:ring-sky-500"
              />
              Destacar al inicio
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={cerrarModal}
              disabled={subiendo}
              className={claseBotonSecundario}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoProyecto || subiendo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              <Save size={15} />
              {guardandoProyecto ? 'Guardando...' : 'Guardar proyecto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
