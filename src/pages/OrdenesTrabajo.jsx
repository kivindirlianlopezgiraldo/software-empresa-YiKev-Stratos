import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  Factory,
  ImagePlus,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Trash2,
  Truck,
  Wrench,
  X,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  COLORES_PERFIL,
  ESPESORES_VIDRIO,
  ESTADOS,
  ESTADOS_LIST,
  ESTADO_ESTILO,
  TIPOS_TRABAJO,
  TIPOS_VIDRIO,
  permisosDe,
} from '../lib/constants';
import { formatFecha, formatFechaHora, nuevoCodigoOrden, nuevoId } from '../lib/format';
import { LARGO_BARRA_DEFECTO_CM, generarDespiece, normalizarDespiece } from '../lib/despiece';
import { imprimirOrdenProduccion } from '../lib/ordenProduccion';
import { notificarRoles } from '../lib/notificaciones';
import {
  MAX_IMAGENES,
  eliminarImagenesReferencia,
  enlaceMapa,
  enlaceTelefono,
  subirImagenReferencia,
  urlsFirmadas,
  validarImagen,
} from '../lib/referencias';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import DespiecePanel from '../components/DespiecePanel';
import useToast from '../hooks/useToast';
import useConfirm from '../hooks/useConfirm';

const numero = (valor, defecto = 0) => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : defecto;
};

const ITEM_VACIO = () => ({
  key: nuevoId(),
  id: null,
  sistemaId: '',
  descripcion: '',
  tipoTrabajo: TIPOS_TRABAJO[0],
  ancho: '',
  alto: '',
  cantidad: '1',
  vidrioTipo: TIPOS_VIDRIO[0],
  vidrioEspesor: ESPESORES_VIDRIO[2],
  color: COLORES_PERFIL[0],
  observaciones: '',
});

const FORM_VACIO = () => ({
  nombreCliente: '',
  telefonoCliente: '',
  direccionCliente: '',
  barrioCliente: '',
  destino: 'medicion',
  items: [ITEM_VACIO()],
});

const MEDIDAS_VACIO = {
  abierto: false,
  orden: null,
  texto: '',
  notas: '',
  existentes: [],
  existentesUrls: {},
  eliminar: [],
  nuevas: [],
};

const VIDRIOS_VACIO = {
  abierto: false,
  orden: null,
  filas: [],
  guardando: false,
  error: '',
};

const TERMINADO_VACIO = {
  abierto: false,
  orden: null,
  archivos: [],
  notas: '',
  guardando: false,
  error: '',
};

function DatoDetalle({ etiqueta, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{etiqueta}</p>
      <div className="text-xs text-slate-200 mt-1 break-words whitespace-pre-wrap">
        {children || '—'}
      </div>
    </div>
  );
}

// Mensaje claro cuando todavía no se aplicó una migración.
function explicarError(err) {
  const texto = err?.message || '';
  const faltanColumnas = [
    'cliente_direccion',
    'cliente_barrio',
    'notas_medidas',
    'imagenes_referencia',
    'medido_en',
    'medido_por',
  ].some((columna) => texto.includes(columna));

  if (faltanColumnas) {
    return (
      'Falta aplicar la migración 002 en Supabase (dirección, notas y fotos). ' +
      'Ejecuta supabase/migrations/002_medidas_referencias.sql en el SQL Editor.'
    );
  }

  const columnasDespieceAvanzado = [
    'largo_barra_cm',
    'formula_config',
    'angulo_corte',
    'retales_produccion',
  ].some((columna) => texto.includes(columna));

  if (columnasDespieceAvanzado) {
    return (
      'Falta aplicar la migración 008 en Supabase (despiece avanzado y retales). ' +
      'Ejecuta supabase/migrations/008_despiece_avanzado_retales.sql en el SQL Editor.'
    );
  }

  const columnasProduccion = [
    'origen',
    'despiece',
    'produccion_id',
    'fotos_terminado',
    'medidas_vidrio_enviadas_en',
    'notas_produccion',
    'orden_items',
    'orden_vidrios',
    'notificaciones',
  ].some((columna) => texto.includes(columna));

  if (columnasProduccion) {
    return (
      'Falta aplicar la migración 005 en Supabase (producción, despiece y herramientas). ' +
      'Ejecuta supabase/migrations/005_produccion_herramientas_ia.sql en el SQL Editor.'
    );
  }

  return texto;
}

export default function OrdenesTrabajo({ perfil, ordenInicialId = null, onOrdenAbierta }) {
  const [ordenes, setOrdenes] = useState([]);
  const [items, setItems] = useState([]);
  const [vidrios, setVidrios] = useState([]);
  const [sistemas, setSistemas] = useState([]);
  const [retales, setRetales] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  const [modalOrden, setModalOrden] = useState(false);
  const [ordenEditando, setOrdenEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [modalMedidas, setModalMedidas] = useState(MEDIDAS_VACIO);
  const [errorMedidas, setErrorMedidas] = useState('');
  const [guardandoMedidas, setGuardandoMedidas] = useState(false);

  const [modalVidrios, setModalVidrios] = useState(VIDRIOS_VACIO);
  const [modalTerminado, setModalTerminado] = useState(TERMINADO_VACIO);

  const [detalle, setDetalle] = useState({ abierto: false, orden: null });
  const [imagenesDetalle, setImagenesDetalle] = useState({
    cargando: false,
    referencia: [],
    terminado: [],
  });

  const { alerta, mostrar, cerrar } = useToast();
  const confirmar = useConfirm();
  const permisos = useMemo(() => permisosDe(perfil?.rol), [perfil?.rol]);
  const solicitudDetalle = useRef(0);
  const ordenInicialAbierta = useRef(null);

  const consultarDatos = useCallback(async () => {
    const [resOrdenes, resSistemas, resMateriales, resRetales, resEmpresa] = await Promise.all([
      supabase.from('ordenes_trabajo').select('*').order('creado_en', { ascending: false }),
      supabase.from('sistemas_trabajo').select('*').order('nombre', { ascending: true }),
      supabase.from('sistema_materiales').select('*, material:material_id(*)'),
      // La tabla de retales llega con la migración 008.
      supabase
        .from('retales_produccion')
        .select('*')
        .eq('disponible', true)
        .order('largo_cm', { ascending: false }),
      supabase.from('empresa_config').select('*').eq('id', 1).maybeSingle(),
    ]);

    if (resOrdenes.error) throw resOrdenes.error;

    const materiales = resMateriales.error ? [] : resMateriales.data ?? [];
    const filasSistemas = (resSistemas.error ? [] : resSistemas.data ?? []).map((sistema) => ({
      ...sistema,
      materiales: materiales.filter((linea) => linea.sistema_id === sistema.id),
    }));

    // Estas tablas llegan con la migración 005. Si aún no existe, la app sigue
    // funcionando con el flujo básico.
    const [resItems, resVidrios] = await Promise.all([
      supabase.from('orden_items').select('*').order('orden', { ascending: true }),
      supabase.from('orden_vidrios').select('*').order('creado_en', { ascending: true }),
    ]);

    return {
      ordenes: resOrdenes.data ?? [],
      sistemas: filasSistemas,
      items: resItems.error ? [] : resItems.data ?? [],
      vidrios: resVidrios.error ? [] : resVidrios.data ?? [],
      retales: resRetales.error ? [] : resRetales.data ?? [],
      empresa: resEmpresa.error ? null : resEmpresa.data ?? null,
    };
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const datos = await consultarDatos();
        if (!activo) return;
        setOrdenes(datos.ordenes);
        setSistemas(datos.sistemas);
        setItems(datos.items);
        setVidrios(datos.vidrios);
        setRetales(datos.retales);
        setEmpresa(datos.empresa);
        setError('');
      } catch (err) {
        if (activo) setError('No se pudieron cargar las órdenes: ' + explicarError(err));
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

  // Actualizaciones en vivo (requiere Realtime activo en la tabla)
  useEffect(() => {
    const canal = supabase
      .channel('cambios-ordenes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo' },
        () => refrescar(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [refrescar]);

  const itemsPorOrden = useMemo(() => {
    const mapa = new Map();
    items.forEach((item) => {
      if (!mapa.has(item.orden_id)) mapa.set(item.orden_id, []);
      mapa.get(item.orden_id).push(item);
    });
    return mapa;
  }, [items]);

  const vidriosPorOrden = useMemo(() => {
    const mapa = new Map();
    vidrios.forEach((vidrio) => {
      if (!mapa.has(vidrio.orden_id)) mapa.set(vidrio.orden_id, []);
      mapa.get(vidrio.orden_id).push(vidrio);
    });
    return mapa;
  }, [vidrios]);

  const calcularDespiece = useCallback(
    (ordenId) =>
      generarDespiece(itemsPorOrden.get(ordenId) || [], sistemas, {
        retales,
        largoBarraCm: LARGO_BARRA_DEFECTO_CM,
      }),
    [itemsPorOrden, sistemas, retales],
  );

  // Firma las URLs de las fotos al abrir la ficha de detalle
  const abrirDetalle = useCallback((orden) => {
    const solicitud = solicitudDetalle.current + 1;
    solicitudDetalle.current = solicitud;
    setDetalle({ abierto: true, orden });

    const referencias = orden.imagenes_referencia || [];
    const terminados = orden.fotos_terminado || [];
    setImagenesDetalle({
      cargando: referencias.length + terminados.length > 0,
      referencia: [],
      terminado: [],
    });
    if (!referencias.length && !terminados.length) return;

    Promise.all([urlsFirmadas(referencias), urlsFirmadas(terminados)]).then(
      ([fotosReferencia, fotosTerminado]) => {
        if (solicitud === solicitudDetalle.current) {
          setImagenesDetalle({
            cargando: false,
            referencia: fotosReferencia,
            terminado: fotosTerminado,
          });
        }
      },
    );
  }, []);

  const cerrarDetalle = () => {
    solicitudDetalle.current += 1;
    setDetalle({ abierto: false, orden: null });
    setImagenesDetalle({ cargando: false, referencia: [], terminado: [] });
  };

  // Abre automáticamente la orden cuando se llega desde una notificación.
  useEffect(() => {
    if (!ordenInicialId || cargando) return;
    if (ordenInicialAbierta.current === ordenInicialId) return;

    ordenInicialAbierta.current = ordenInicialId;
    const orden = ordenes.find((fila) => fila.id === ordenInicialId);
    if (orden) abrirDetalle(orden);
    if (onOrdenAbierta) onOrdenAbierta();
  }, [ordenInicialId, cargando, ordenes, onOrdenAbierta, abrirDetalle]);

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const actualizarItem = (key, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.key === key
          ? {
              ...item,
              [campo]: valor,
              ...(campo === 'sistemaId'
                ? {
                    descripcion:
                      item.descripcion ||
                      sistemas.find((sistema) => sistema.id === valor)?.nombre ||
                      '',
                    tipoTrabajo:
                      sistemas.find((sistema) => sistema.id === valor)?.nombre || item.tipoTrabajo,
                  }
                : {}),
            }
          : item,
      ),
    }));
    if (errorForm) setErrorForm('');
  };

  const agregarItem = () =>
    setForm((prev) => ({ ...prev, items: [...prev.items, ITEM_VACIO()] }));

  const quitarItem = (key) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.key !== key) : prev.items,
    }));

  const abrirNueva = () => {
    setOrdenEditando(null);
    setForm(FORM_VACIO());
    setErrorForm('');
    setModalOrden(true);
  };

  const abrirEditar = (orden) => {
    const filas = (itemsPorOrden.get(orden.id) || []).map((item) => ({
      key: item.id || nuevoId(),
      id: item.id,
      sistemaId: item.sistema_id || '',
      descripcion: item.descripcion || '',
      tipoTrabajo: item.tipo_trabajo || orden.tipo_trabajo || TIPOS_TRABAJO[0],
      ancho: item.ancho_cm ? String(item.ancho_cm) : '',
      alto: item.alto_cm ? String(item.alto_cm) : '',
      cantidad: String(item.cantidad ?? 1),
      vidrioTipo: item.vidrio_tipo || TIPOS_VIDRIO[0],
      vidrioEspesor: item.vidrio_espesor || ESPESORES_VIDRIO[2],
      color: item.color || COLORES_PERFIL[0],
      observaciones: item.observaciones || '',
    }));

    setOrdenEditando(orden);
    setForm({
      nombreCliente: orden.cliente_nombre || '',
      telefonoCliente: orden.cliente_telefono || '',
      direccionCliente: orden.cliente_direccion || '',
      barrioCliente: orden.cliente_barrio || '',
      destino: orden.origen === 'produccion' ? 'produccion' : 'medicion',
      items:
        filas.length > 0
          ? filas
          : [
              {
                ...ITEM_VACIO(),
                tipoTrabajo: orden.tipo_trabajo || TIPOS_TRABAJO[0],
                descripcion: orden.tipo_trabajo || '',
              },
            ],
    });
    setErrorForm('');
    setModalOrden(true);
  };

  /** Guarda el snapshot del despiece sin interrumpir el flujo si falta la 005. */
  const guardarDespiece = useCallback(
    async (ordenId, despiece) => {
      if (!despiece) return;
      const { error: errorUpdate } = await supabase
        .from('ordenes_trabajo')
        .update({
          despiece,
          despiece_generado_en: new Date().toISOString(),
          despiece_generado_por: perfil?.nombre_completo ?? null,
        })
        .eq('id', ordenId);

      if (errorUpdate) {
        console.warn('No se pudo guardar el despiece:', errorUpdate.message);
      }
    },
    [perfil?.nombre_completo],
  );

  const actualizarOrden = useCallback(
    async (ordenId, cambios, mensajeExito, despiece = null) => {
      try {
        const payload = despiece
          ? {
              ...cambios,
              despiece,
              despiece_generado_en: new Date().toISOString(),
              despiece_generado_por: perfil?.nombre_completo ?? null,
            }
          : cambios;

        let { error: errorUpdate } = await supabase
          .from('ordenes_trabajo')
          .update(payload)
          .eq('id', ordenId);

        // Si aún no está aplicada la migración 005, reintenta con lo básico.
        if (errorUpdate && despiece) {
          const reintento = await supabase
            .from('ordenes_trabajo')
            .update(cambios)
            .eq('id', ordenId);
          errorUpdate = reintento.error;
        }

        if (errorUpdate) throw errorUpdate;
        mostrar('¡Listo!', mensajeExito, 'exito');
        refrescar();
        return true;
      } catch (err) {
        mostrar('No se pudo actualizar', explicarError(err));
        return false;
      }
    },
    [refrescar, mostrar, perfil?.nombre_completo],
  );

  const construirFilas = (ordenId) =>
    form.items.map((item, indice) => ({
      id: item.id || nuevoId(),
      orden_id: ordenId,
      sistema_id: item.sistemaId || null,
      sistema_nombre: sistemas.find((sistema) => sistema.id === item.sistemaId)?.nombre || null,
      descripcion: item.descripcion.trim() || `Proyecto ${indice + 1}`,
      tipo_trabajo: item.tipoTrabajo,
      ancho_cm: Math.max(0, numero(item.ancho)),
      alto_cm: Math.max(0, numero(item.alto)),
      cantidad: Math.max(1, Math.round(numero(item.cantidad, 1))),
      vidrio_tipo: item.vidrioTipo,
      vidrio_espesor: item.vidrioEspesor,
      color: item.color,
      observaciones: item.observaciones.trim(),
      orden: indice,
    }));

  const guardarItems = async (ordenId, filas) => {
    if (ordenEditando) {
      const { data: actuales, error: errorActuales } = await supabase
        .from('orden_items')
        .select('id')
        .eq('orden_id', ordenId);
      if (errorActuales) throw errorActuales;

      const conservados = new Set(filas.map((fila) => fila.id));
      const aBorrar = (actuales ?? [])
        .map((fila) => fila.id)
        .filter((id) => !conservados.has(id));

      if (aBorrar.length) {
        const { error: errorDelete } = await supabase.from('orden_items').delete().in('id', aBorrar);
        if (errorDelete) throw errorDelete;
      }

      const { error: errorUpsert } = await supabase.from('orden_items').upsert(filas);
      if (errorUpsert) throw errorUpsert;
      return;
    }

    const { error: errorInsert } = await supabase.from('orden_items').insert(filas);
    if (errorInsert) throw errorInsert;
  };

  const handleGuardarOrden = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorForm('');

    try {
      const nombre = form.nombreCliente.trim();
      const direccion = form.direccionCliente.trim();
      if (!nombre) throw new Error('El nombre del cliente es obligatorio.');
      if (!direccion) {
        throw new Error('La dirección es obligatoria: el instalador la necesita para llegar.');
      }

      const filasForm = form.items.filter(
        (item) => numero(item.ancho) > 0 && numero(item.alto) > 0,
      );
      if (!filasForm.length) {
        throw new Error('Agrega al menos un proyecto con ancho y alto mayores que cero.');
      }

      const ordenId = ordenEditando?.id || nuevoId();
      const filas = construirFilas(ordenId);
      const despiece = generarDespiece(filas, sistemas, {
        retales,
        largoBarraCm: LARGO_BARRA_DEFECTO_CM,
      });
      const primerItem = filas[0];
      const vaAProduccion = !ordenEditando && form.destino === 'produccion';

      const payload = {
        cliente_nombre: nombre,
        cliente_telefono: form.telefonoCliente.trim(),
        cliente_direccion: direccion,
        cliente_barrio: form.barrioCliente.trim(),
        tipo_trabajo: primerItem?.tipo_trabajo || TIPOS_TRABAJO[0],
      };

      if (ordenEditando) {
        const { error: errorUpdate } = await supabase
          .from('ordenes_trabajo')
          .update(payload)
          .eq('id', ordenId);
        if (errorUpdate) throw errorUpdate;
      } else {
        const basico = {
          id: ordenId,
          codigo_orden: nuevoCodigoOrden(),
          ...payload,
          estado: vaAProduccion ? ESTADOS.PENDIENTE_PRODUCCION : ESTADOS.PENDIENTE_ASIGNACION,
        };

        let { error: errorInsert } = await supabase
          .from('ordenes_trabajo')
          .insert([{ ...basico, origen: vaAProduccion ? 'produccion' : 'medicion' }]);

        if (errorInsert && /origen/i.test(errorInsert.message)) {
          const reintento = await supabase.from('ordenes_trabajo').insert([basico]);
          errorInsert = reintento.error;
        }
        if (errorInsert) throw errorInsert;
      }

      let errorItems = null;
      try {
        await guardarItems(ordenId, filas);
      } catch (err) {
        errorItems = err;
      }

      if (vaAProduccion) {
        await guardarDespiece(ordenId, despiece);
        await notificarRoles(['produccion'], {
          ordenId,
          tipo: 'produccion',
          titulo: `Nuevo trabajo en producción · ${nombre}`,
          mensaje: `${filas.length} proyecto(s) listos para fabricar. Revisa el despiece.`,
        });
      } else if (!ordenEditando) {
        await notificarRoles(['instalador'], {
          ordenId,
          tipo: 'orden',
          titulo: `Nueva orden para medir · ${nombre}`,
          mensaje: `${direccion}${form.barrioCliente.trim() ? ` · ${form.barrioCliente.trim()}` : ''}`,
        });
      }

      setModalOrden(false);

      if (errorItems) {
        mostrar(
          'Orden guardada con novedad',
          'La orden se guardó, pero los proyectos no: ' + explicarError(errorItems),
        );
      } else if (ordenEditando) {
        mostrar('¡Actualizado!', 'La orden fue modificada correctamente.', 'exito');
      } else if (vaAProduccion) {
        mostrar(
          '¡Orden enviada a producción!',
          'El taller ya puede ver el despiece, los cortes y las medidas de vidrio.',
          'exito',
        );
      } else {
        mostrar(
          '¡Orden creada!',
          'La solicitud se publicó en la bolsa de instaladores.',
          'exito',
        );
      }

      refrescar();
    } catch (err) {
      setErrorForm(explicarError(err) || 'Error al procesar la orden.');
    } finally {
      setGuardando(false);
    }
  };

  const tomarOrden = async (orden) => {
    const ok = await actualizarOrden(
      orden.id,
      {
        instalador_id: perfil.id,
        instalador_nombre: perfil.nombre_completo,
        estado: ESTADOS.ASIGNADO_INSTALADOR,
      },
      'Tomaste la orden. Ya puedes ver la dirección y tomar medidas.',
    );

    if (ok) {
      await notificarRoles(['jefe', 'admin'], {
        ordenId: orden.id,
        tipo: 'orden',
        titulo: `Orden tomada · ${orden.cliente_nombre}`,
        mensaje: `${perfil?.nombre_completo} saldrá a tomar medidas.`,
      });
    }
  };

  const enviarAProduccion = async (orden) => {
    const despiece = calcularDespiece(orden.id);
    const ok = await actualizarOrden(
      orden.id,
      { estado: ESTADOS.PENDIENTE_PRODUCCION },
      'La orden pasó al taller con su despiece.',
      despiece,
    );

    if (ok) {
      await notificarRoles(['produccion'], {
        ordenId: orden.id,
        tipo: 'produccion',
        titulo: `Trabajo entrante · ${orden.cliente_nombre}`,
        mensaje: 'Revisa el despiece y acepta el trabajo cuando estés listo.',
      });
    }
  };

  const aceptarProduccion = async (orden) => {
    const ok = await actualizarOrden(
      orden.id,
      {
        estado: ESTADOS.EN_PRODUCCION,
        produccion_id: perfil.id,
        produccion_nombre: perfil.nombre_completo,
        aceptada_en: new Date().toISOString(),
      },
      'Aceptaste el trabajo. El reloj de producción está corriendo.',
    );

    if (ok) {
      await notificarRoles(['jefe', 'admin'], {
        ordenId: orden.id,
        tipo: 'produccion',
        titulo: `Producción aceptada · ${orden.cliente_nombre}`,
        mensaje: `${perfil?.nombre_completo} está fabricando este trabajo.`,
      });
    }
  };

  const cerrarModalMedidas = useCallback(() => {
    setModalMedidas((prev) => {
      prev.nuevas.forEach((item) => URL.revokeObjectURL(item.preview));
      return MEDIDAS_VACIO;
    });
    setErrorMedidas('');
  }, []);

  const abrirModalMedidas = (orden) => {
    const existentes = orden.imagenes_referencia || [];
    setErrorMedidas('');
    setModalMedidas({
      ...MEDIDAS_VACIO,
      abierto: true,
      orden,
      texto: orden.medidas_terreno || '',
      notas: orden.notas_medidas || '',
      existentes,
    });

    if (existentes.length) {
      urlsFirmadas(existentes).then((fotos) => {
        setModalMedidas((prev) => {
          if (!prev.abierto || prev.orden?.id !== orden.id) return prev;
          const mapa = {};
          fotos.forEach(({ ruta, url }) => {
            mapa[ruta] = url;
          });
          return { ...prev, existentesUrls: mapa };
        });
      });
    }
  };

  const seleccionarImagenes = (evento) => {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (!archivos.length) return;

    setErrorMedidas('');

    const conservadas = modalMedidas.existentes.length - modalMedidas.eliminar.length;
    const disponibles = MAX_IMAGENES - conservadas - modalMedidas.nuevas.length;

    if (disponibles <= 0) {
      setErrorMedidas(`Máximo ${MAX_IMAGENES} imágenes por orden.`);
      return;
    }

    const aceptadas = [];
    const errores = [];

    for (const archivo of archivos) {
      if (aceptadas.length >= disponibles) {
        errores.push(`Solo puedes adjuntar ${MAX_IMAGENES} imágenes en total.`);
        break;
      }
      const errorArchivo = validarImagen(archivo);
      if (errorArchivo) {
        errores.push(errorArchivo);
        continue;
      }
      aceptadas.push({
        id: nuevoId(),
        file: archivo,
        preview: URL.createObjectURL(archivo),
      });
    }

    if (aceptadas.length) {
      setModalMedidas((prev) => ({ ...prev, nuevas: [...prev.nuevas, ...aceptadas] }));
    }
    if (errores.length) setErrorMedidas(errores.join(' '));
  };

  const quitarNueva = (id) => {
    setModalMedidas((prev) => {
      const item = prev.nuevas.find((nueva) => nueva.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return { ...prev, nuevas: prev.nuevas.filter((nueva) => nueva.id !== id) };
    });
  };

  const alternarEliminarExistente = (ruta) => {
    setModalMedidas((prev) => ({
      ...prev,
      eliminar: prev.eliminar.includes(ruta)
        ? prev.eliminar.filter((item) => item !== ruta)
        : [...prev.eliminar, ruta],
    }));
  };

  const guardarMedidas = async (evento) => {
    evento.preventDefault();
    const { orden } = modalMedidas;
    if (!orden) return;

    const medidas = modalMedidas.texto.trim();
    if (!medidas) {
      setErrorMedidas('Escribe al menos una medida antes de enviar.');
      return;
    }

    setGuardandoMedidas(true);
    setErrorMedidas('');
    const subidas = [];

    try {
      for (const item of modalMedidas.nuevas) {
        const ruta = await subirImagenReferencia(item.file, orden.id);
        subidas.push(ruta);
      }

      const conservadas = modalMedidas.existentes.filter(
        (ruta) => !modalMedidas.eliminar.includes(ruta),
      );
      const imagenes = [...conservadas, ...subidas];
      const despiece = calcularDespiece(orden.id);

      const cambios = {
        medidas_terreno: medidas,
        notas_medidas: modalMedidas.notas.trim() || null,
        imagenes_referencia: imagenes,
        medido_en: new Date().toISOString(),
        medido_por: perfil?.nombre_completo ?? null,
        estado: ESTADOS.COTIZACION_PENDIENTE,
      };

      let { error: errorUpdate } = await supabase
        .from('ordenes_trabajo')
        .update({
          ...cambios,
          despiece,
          despiece_generado_en: new Date().toISOString(),
          despiece_generado_por: perfil?.nombre_completo ?? null,
        })
        .eq('id', orden.id);

      if (errorUpdate && /despiece/i.test(errorUpdate.message)) {
        const reintento = await supabase
          .from('ordenes_trabajo')
          .update(cambios)
          .eq('id', orden.id);
        errorUpdate = reintento.error;
      }

      if (errorUpdate) throw errorUpdate;

      if (modalMedidas.eliminar.length) {
        await eliminarImagenesReferencia(modalMedidas.eliminar);
      }

      modalMedidas.nuevas.forEach((item) => URL.revokeObjectURL(item.preview));
      setModalMedidas(MEDIDAS_VACIO);

      await notificarRoles(['jefe', 'admin'], {
        ordenId: orden.id,
        tipo: 'medida',
        titulo: `Medidas enviadas · ${orden.cliente_nombre}`,
        mensaje: `La orden pasó a ${ESTADOS.COTIZACION_PENDIENTE}. Revisa el despiece y aprueba.`,
      });

      mostrar(
        '¡Medidas enviadas!',
        `Se enviaron las cotas${imagenes.length ? ` y ${imagenes.length} foto(s)` : ''}. La orden pasó a cotización.`,
        'exito',
      );
      refrescar();
    } catch (err) {
      if (subidas.length) await eliminarImagenesReferencia(subidas);
      const mensaje = explicarError(err) || 'No se pudieron enviar las medidas.';
      setErrorMedidas(mensaje);
      mostrar('No se pudieron enviar las medidas', mensaje);
    } finally {
      setGuardandoMedidas(false);
    }
  };

  const devolverABolsa = async () => {
    if (!modalMedidas.orden) return;
    await actualizarOrden(
      modalMedidas.orden.id,
      { estado: ESTADOS.PENDIENTE_ASIGNACION, instalador_id: null, instalador_nombre: null },
      'La orden volvió a la bolsa de instaladores.',
    );
    cerrarModalMedidas();
  };

  const filasVidrioSugeridas = (orden) => {
    const guardadas = vidriosPorOrden.get(orden.id) || [];
    if (guardadas.length) {
      return guardadas.map((vidrio) => ({
        key: vidrio.id,
        descripcion: vidrio.descripcion || '',
        ancho: String(vidrio.ancho_cm ?? ''),
        alto: String(vidrio.alto_cm ?? ''),
        cantidad: String(vidrio.cantidad ?? 1),
        espesor: vidrio.espesor || '',
        tipo: vidrio.tipo || '',
        observaciones: vidrio.observaciones || '',
      }));
    }

    const guardado = normalizarDespiece(orden.despiece);
    const despiece = guardado?.items?.length ? guardado : calcularDespiece(orden.id);
    const filas = [];
    (despiece?.items || []).forEach((item) => {
      (item.vidrios || []).forEach((vidrio) => {
        filas.push({
          key: nuevoId(),
          descripcion: `${item.descripcion} · ${vidrio.nombre}`,
          ancho: (numero(vidrio.anchoMm) / 10).toFixed(1),
          alto: (numero(vidrio.altoMm) / 10).toFixed(1),
          cantidad: String(vidrio.cantidad ?? 1),
          espesor: item.vidrioEspesor || '',
          tipo: item.vidrioTipo || '',
          observaciones: '',
        });
      });
    });

    return filas.length
      ? filas
      : [
          {
            key: nuevoId(),
            descripcion: '',
            ancho: '',
            alto: '',
            cantidad: '1',
            espesor: '',
            tipo: '',
            observaciones: '',
          },
        ];
  };

  const abrirVidrios = (orden) =>
    setModalVidrios({
      ...VIDRIOS_VACIO,
      abierto: true,
      orden,
      filas: filasVidrioSugeridas(orden),
    });

  const actualizarFilaVidrio = (key, campo, valor) =>
    setModalVidrios((prev) => ({
      ...prev,
      filas: prev.filas.map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila)),
    }));

  const agregarFilaVidrio = () =>
    setModalVidrios((prev) => ({
      ...prev,
      filas: [
        ...prev.filas,
        {
          key: nuevoId(),
          descripcion: '',
          ancho: '',
          alto: '',
          cantidad: '1',
          espesor: '',
          tipo: '',
          observaciones: '',
        },
      ],
    }));

  const quitarFilaVidrio = (key) =>
    setModalVidrios((prev) => ({
      ...prev,
      filas: prev.filas.length > 1 ? prev.filas.filter((fila) => fila.key !== key) : prev.filas,
    }));

  const guardarVidrios = async (evento) => {
    evento.preventDefault();
    const { orden } = modalVidrios;
    if (!orden) return;

    const filas = modalVidrios.filas.filter(
      (fila) => numero(fila.ancho) > 0 && numero(fila.alto) > 0,
    );
    if (!filas.length) {
      setModalVidrios((prev) => ({
        ...prev,
        error: 'Registra al menos un vidrio con ancho y alto.',
      }));
      return;
    }

    setModalVidrios((prev) => ({ ...prev, guardando: true, error: '' }));

    try {
      const { error: errorDelete } = await supabase
        .from('orden_vidrios')
        .delete()
        .eq('orden_id', orden.id);
      if (errorDelete) throw errorDelete;

      const { error: errorInsert } = await supabase.from('orden_vidrios').insert(
        filas.map((fila) => ({
          id: nuevoId(),
          orden_id: orden.id,
          descripcion: fila.descripcion.trim() || 'Vidrio',
          ancho_cm: numero(fila.ancho),
          alto_cm: numero(fila.alto),
          cantidad: Math.max(1, Math.round(numero(fila.cantidad, 1))),
          espesor: fila.espesor,
          tipo: fila.tipo,
          observaciones: fila.observaciones.trim(),
          enviado_por: perfil?.id ?? null,
          enviado_por_nombre: perfil?.nombre_completo ?? null,
        })),
      );
      if (errorInsert) throw errorInsert;

      const { error: errorUpdate } = await supabase
        .from('ordenes_trabajo')
        .update({ medidas_vidrio_enviadas_en: new Date().toISOString() })
        .eq('id', orden.id);
      if (errorUpdate) throw errorUpdate;

      await notificarRoles(['jefe'], {
        ordenId: orden.id,
        tipo: 'medida',
        titulo: `Medidas de vidrio · ${orden.cliente_nombre}`,
        mensaje: `${filas.length} medida(s) de vidrio listas para cortar.`,
      });

      setModalVidrios(VIDRIOS_VACIO);
      mostrar('¡Vidrios enviados!', 'El jefe de taller recibió las medidas de vidrio.', 'exito');
      refrescar();
    } catch (err) {
      setModalVidrios((prev) => ({ ...prev, error: explicarError(err) }));
    } finally {
      setModalVidrios((prev) => ({ ...prev, guardando: false }));
    }
  };

  const abrirTerminado = (orden) =>
    setModalTerminado({ ...TERMINADO_VACIO, abierto: true, orden });

  const cerrarTerminado = useCallback(() => {
    setModalTerminado((prev) => {
      prev.archivos.forEach((item) => URL.revokeObjectURL(item.preview));
      return TERMINADO_VACIO;
    });
  }, []);

  const seleccionarFotosTerminado = (evento) => {
    const archivos = Array.from(evento.target.files || []);
    evento.target.value = '';
    if (!archivos.length) return;

    const disponibles = MAX_IMAGENES - modalTerminado.archivos.length;
    if (disponibles <= 0) {
      setModalTerminado((prev) => ({
        ...prev,
        error: `Máximo ${MAX_IMAGENES} fotos del producto terminado.`,
      }));
      return;
    }

    const aceptadas = [];
    const errores = [];

    for (const archivo of archivos) {
      if (aceptadas.length >= disponibles) {
        errores.push(`Solo puedes adjuntar ${MAX_IMAGENES} fotos.`);
        break;
      }
      const errorArchivo = validarImagen(archivo);
      if (errorArchivo) {
        errores.push(errorArchivo);
        continue;
      }
      aceptadas.push({ id: nuevoId(), file: archivo, preview: URL.createObjectURL(archivo) });
    }

    setModalTerminado((prev) => ({
      ...prev,
      archivos: [...prev.archivos, ...aceptadas],
      error: errores.join(' '),
    }));
  };

  const quitarFotoTerminado = (id) => {
    setModalTerminado((prev) => {
      const item = prev.archivos.find((archivo) => archivo.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return { ...prev, archivos: prev.archivos.filter((archivo) => archivo.id !== id) };
    });
  };

  const guardarTerminado = async (evento) => {
    evento.preventDefault();
    const { orden } = modalTerminado;
    if (!orden) return;

    if (!modalTerminado.archivos.length) {
      setModalTerminado((prev) => ({
        ...prev,
        error: 'Sube al menos una foto del producto terminado.',
      }));
      return;
    }

    setModalTerminado((prev) => ({ ...prev, guardando: true, error: '' }));
    const subidas = [];

    try {
      for (const item of modalTerminado.archivos) {
        const ruta = await subirImagenReferencia(item.file, `${orden.id}/terminado`);
        subidas.push(ruta);
      }

      const { error: errorUpdate } = await supabase
        .from('ordenes_trabajo')
        .update({
          estado: ESTADOS.FINALIZADO,
          fotos_terminado: subidas,
          terminado_en: new Date().toISOString(),
          notas_produccion: modalTerminado.notas.trim() || null,
          produccion_id: orden.produccion_id || perfil?.id || null,
          produccion_nombre: orden.produccion_nombre || perfil?.nombre_completo || null,
        })
        .eq('id', orden.id);

      if (errorUpdate) throw errorUpdate;

      modalTerminado.archivos.forEach((item) => URL.revokeObjectURL(item.preview));
      setModalTerminado(TERMINADO_VACIO);

      await notificarRoles(['jefe', 'admin'], {
        ordenId: orden.id,
        tipo: 'produccion',
        titulo: `Trabajo terminado · ${orden.cliente_nombre}`,
        mensaje: 'Producción subió la foto del producto terminado. Listo para entrega.',
      });

      mostrar(
        '¡Trabajo terminado!',
        'La foto del producto quedó guardada y el jefe recibió el aviso.',
        'exito',
      );
      refrescar();
    } catch (err) {
      if (subidas.length) await eliminarImagenesReferencia(subidas);
      setModalTerminado((prev) => ({ ...prev, error: explicarError(err) }));
    } finally {
      setModalTerminado((prev) => ({ ...prev, guardando: false }));
    }
  };

  const eliminarOrden = async (orden) => {
    if (!permisos.puedeAdministrar) return;
    const confirmado = await confirmar({
      titulo: 'Eliminar orden de trabajo',
      mensaje: `¿Eliminar definitivamente la orden de "${orden.cliente_nombre}"?`,
      confirmarTexto: 'Eliminar orden',
    });
    if (!confirmado) return;

    try {
      const { error: errorDelete } = await supabase
        .from('ordenes_trabajo')
        .delete()
        .eq('id', orden.id);
      if (errorDelete) throw errorDelete;
      mostrar('Eliminado', 'La orden fue eliminada.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('Error al eliminar', explicarError(err));
    }
  };

  const filtradas = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return ordenes.filter((orden) => {
      const coincideEstado = filtroEstado === 'TODOS' || orden.estado === filtroEstado;
      if (!coincideEstado) return false;
      if (!texto) return true;
      const filas = itemsPorOrden.get(orden.id) || [];
      return [
        orden.cliente_nombre,
        orden.cliente_telefono,
        orden.cliente_direccion,
        orden.cliente_barrio,
        orden.tipo_trabajo,
        orden.estado,
        orden.instalador_nombre,
        orden.produccion_nombre,
        ...filas.map((fila) => fila.descripcion),
        ...filas.map((fila) => fila.sistema_nombre),
      ]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto));
    });
  }, [ordenes, busqueda, filtroEstado, itemsPorOrden]);

  const resumen = useMemo(
    () => ({
      pendientes: ordenes.filter((o) => o.estado === ESTADOS.PENDIENTE_ASIGNACION).length,
      asignadas: ordenes.filter((o) => o.estado === ESTADOS.ASIGNADO_INSTALADOR).length,
      porProducir: ordenes.filter((o) => o.estado === ESTADOS.PENDIENTE_PRODUCCION).length,
      produccion: ordenes.filter((o) => o.estado === ESTADOS.EN_PRODUCCION).length,
    }),
    [ordenes],
  );

  const despieceDeOrden = useCallback(
    (orden) => {
      const guardado = normalizarDespiece(orden?.despiece);
      if (guardado?.items?.length) return guardado;
      return calcularDespiece(orden.id);
    },
    [calcularDespiece],
  );

  const descargarOrdenProduccion = useCallback(
    (orden) => {
      const filas = itemsPorOrden.get(orden.id) || [];
      const abierta = imprimirOrdenProduccion({
        empresa,
        orden,
        items: filas,
        despiece: despieceDeOrden(orden),
        generadoPor: perfil?.nombre_completo,
      });
      if (abierta === false) {
        mostrar(
          'Ventana emergente bloqueada',
          'Permite las ventanas emergentes para abrir la orden de producción.',
          'advertencia',
        );
      }
    },
    [despieceDeOrden, empresa, itemsPorOrden, mostrar, perfil?.nombre_completo],
  );

  const tieneDetalleProduccion = useCallback(
    (orden) => {
      const filas = itemsPorOrden.get(orden.id) || [];
      const guardado = normalizarDespiece(orden.despiece);
      return filas.length > 0 || (guardado?.items?.length || 0) > 0;
    },
    [itemsPorOrden],
  );

  const accionesDe = (orden) => {
    const botones = [];
    const esAdminOJefe = permisos.esAdmin || permisos.esJefe;
    const esMia = !orden.instalador_id || orden.instalador_id === perfil?.id;

    if (permisos.puedeVerProduccion && tieneDetalleProduccion(orden)) {
      botones.push(
        <button
          key="orden-produccion"
          type="button"
          onClick={() => descargarOrdenProduccion(orden)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
          title="Descargar la orden de producción con materiales y accesorios"
        >
          <Download size={13} /> Orden de Producción
        </button>,
      );
    }

    if (orden.estado === ESTADOS.PENDIENTE_ASIGNACION) {
      if (permisos.puedeInstalar && !orden.instalador_id) {
        botones.push(
          <button
            key="tomar"
            type="button"
            onClick={() => tomarOrden(orden)}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
          >
            Tomar Orden
          </button>,
        );
      }
      if (esAdminOJefe) {
        botones.push(
          <button
            key="produccion-directa"
            type="button"
            onClick={() => enviarAProduccion(orden)}
            className="px-3 py-1.5 bg-orange-700 hover:bg-orange-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
          >
            Enviar a Producción
          </button>,
        );
      }
    }

    if (
      orden.estado === ESTADOS.ASIGNADO_INSTALADOR &&
      permisos.puedeMedir &&
      (esMia || esAdminOJefe)
    ) {
      botones.push(
        <button
          key="medidas"
          type="button"
          onClick={() => abrirModalMedidas(orden)}
          className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Enviar Medidas
        </button>,
      );
    }

    if (esAdminOJefe && orden.estado === ESTADOS.COTIZACION_PENDIENTE) {
      botones.push(
        <button
          key="aprobar"
          type="button"
          onClick={() => enviarAProduccion(orden)}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Aprobar y Enviar a Taller
        </button>,
      );
    }

    if (permisos.puedeAceptarProduccion && orden.estado === ESTADOS.PENDIENTE_PRODUCCION) {
      botones.push(
        <button
          key="aceptar"
          type="button"
          onClick={() => aceptarProduccion(orden)}
          className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Aceptar Trabajo
        </button>,
      );
    }

    if (permisos.puedeEnviarVidrios && orden.estado === ESTADOS.EN_PRODUCCION) {
      botones.push(
        <button
          key="vidrios"
          type="button"
          onClick={() => abrirVidrios(orden)}
          className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Medidas de Vidrio
        </button>,
      );
    }

    if (permisos.puedeTerminarProduccion && orden.estado === ESTADOS.EN_PRODUCCION) {
      botones.push(
        <button
          key="terminar"
          type="button"
          onClick={() => abrirTerminado(orden)}
          className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Terminar y Subir Foto
        </button>,
      );
    }

    if (esAdminOJefe && orden.estado === ESTADOS.FINALIZADO && !orden.entregado_en) {
      botones.push(
        <button
          key="entregar"
          type="button"
          onClick={() =>
            actualizarOrden(
              orden.id,
              { estado: ESTADOS.ENTREGADO, entregado_en: new Date().toISOString() },
              'Orden marcada como entregada.',
            )
          }
          className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-[11px] shadow-lg transition-all whitespace-nowrap"
        >
          Marcar Entregado
        </button>,
      );
    }

    return botones;
  };

  const ordenDetalle = detalle.orden;
  const mapaDetalle = ordenDetalle
    ? enlaceMapa(ordenDetalle.cliente_direccion, ordenDetalle.cliente_barrio)
    : null;
  const telDetalle = ordenDetalle ? enlaceTelefono(ordenDetalle.cliente_telefono) : null;
  const mapaMedidas = modalMedidas.orden
    ? enlaceMapa(modalMedidas.orden.cliente_direccion, modalMedidas.orden.cliente_barrio)
    : null;
  const telMedidas = modalMedidas.orden
    ? enlaceTelefono(modalMedidas.orden.cliente_telefono)
    : null;
  const totalFotosMedidas =
    modalMedidas.existentes.length -
    modalMedidas.eliminar.length +
    modalMedidas.nuevas.length;

  const itemsDetalle = ordenDetalle ? itemsPorOrden.get(ordenDetalle.id) || [] : [];
  const vidriosDetalle = ordenDetalle ? vidriosPorOrden.get(ordenDetalle.id) || [] : [];
  const despieceDetalle = ordenDetalle ? despieceDeOrden(ordenDetalle) : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Órdenes de Trabajo</h1>
          <p className="text-xs text-slate-400 mt-1">
            Medidas en terreno, cotización, despiece, taller y entrega.
          </p>
        </div>
        {permisos.puedeCrearOrden && (
          <button
            type="button"
            onClick={abrirNueva}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={16} /> Nueva Orden
          </button>
        )}
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { etiqueta: 'Sin asignar', valor: resumen.pendientes, color: 'text-purple-400' },
          { etiqueta: 'En terreno', valor: resumen.asignadas, color: 'text-amber-400' },
          { etiqueta: 'Por producir', valor: resumen.porProducir, color: 'text-orange-400' },
          { etiqueta: 'En taller', valor: resumen.produccion, color: 'text-cyan-400' },
        ].map((item) => (
          <div
            key={item.etiqueta}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 flex items-center justify-between"
          >
            <span className="text-xs text-slate-400 font-medium">{item.etiqueta}</span>
            <span className={`text-xl font-black font-mono ${item.color}`}>
              {cargando ? '…' : item.valor}
            </span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por cliente, dirección, sistema, estado o instalador..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(evento) => setFiltroEstado(evento.target.value)}
          aria-label="Filtrar por estado"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
        >
          <option value="TODOS">Todos los estados</option>
          {ESTADOS_LIST.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
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

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Cliente / Teléfono / Dirección</th>
                <th className="p-4">Proyectos</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Equipo</th>
                <th className="p-4">Creada</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    Cargando órdenes...
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    {ordenes.length === 0
                      ? 'No hay órdenes registradas.'
                      : 'Ninguna orden coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtradas.map((orden) => {
                  const mapa = enlaceMapa(orden.cliente_direccion, orden.cliente_barrio);
                  const tel = enlaceTelefono(orden.cliente_telefono);
                  const fotos = orden.imagenes_referencia?.length || 0;
                  const filas = itemsPorOrden.get(orden.id) || [];
                  const vidriosOrden = vidriosPorOrden.get(orden.id) || [];

                  return (
                    <tr key={orden.id} className="hover:bg-slate-800/40 transition-colors align-top">
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mt-0.5">
                            <Wrench size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate">{orden.cliente_nombre}</p>
                            {tel ? (
                              <a
                                href={tel}
                                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white font-mono font-normal mt-0.5"
                              >
                                <Phone size={10} /> {orden.cliente_telefono}
                              </a>
                            ) : (
                              <p className="text-[10px] text-slate-500 font-mono font-normal mt-0.5">
                                Sin teléfono
                              </p>
                            )}
                            {mapa ? (
                              <a
                                href={mapa}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir la dirección en Google Maps"
                                className="mt-1.5 inline-flex items-start gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-sans font-normal max-w-[15rem]"
                              >
                                <MapPin size={12} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">
                                  {orden.cliente_direccion}
                                  {orden.cliente_barrio ? ` · ${orden.cliente_barrio}` : ''}
                                </span>
                              </a>
                            ) : (
                              <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-amber-400/90 font-sans font-normal">
                                <MapPin size={12} /> Sin dirección registrada
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-slate-300 max-w-[14rem]">
                        {filas.length ? (
                          <>
                            <p className="text-white truncate">{filas[0].descripcion}</p>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                              {filas.length} proyecto{filas.length === 1 ? '' : 's'} ·{' '}
                              {filas.reduce((total, fila) => total + Number(fila.cantidad || 1), 0)}{' '}
                              pieza(s)
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">{orden.tipo_trabajo}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
                            ESTADO_ESTILO[orden.estado] ||
                            'bg-slate-500/10 text-slate-300 border-slate-500/20'
                          }`}
                        >
                          {orden.estado || 'Sin estado'}
                        </span>
                        {orden.origen === 'produccion' && (
                          <p className="mt-1.5 inline-flex items-center gap-1 text-[9px] text-orange-300">
                            <Factory size={10} /> Directo a producción
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-slate-400 text-[10px] font-sans max-w-[12rem]">
                        {orden.instalador_nombre && (
                          <p className="truncate">Instalador: {orden.instalador_nombre}</p>
                        )}
                        {orden.produccion_nombre && (
                          <p className="truncate text-cyan-300">Producción: {orden.produccion_nombre}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {fotos > 0 && (
                            <span className="inline-flex items-center gap-1 text-blue-400">
                              <Camera size={11} /> {fotos}
                            </span>
                          )}
                          {vidriosOrden.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-sky-400">
                              <Ruler size={11} /> {vidriosOrden.length}
                            </span>
                          )}
                          {orden.fotos_terminado?.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 size={11} /> {orden.fotos_terminado.length}
                            </span>
                          )}
                          {!orden.instalador_nombre && !orden.produccion_nombre && (
                            <span>Sin asignar</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                        {formatFecha(orden.creado_en)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {accionesDe(orden)}
                          <button
                            type="button"
                            onClick={() => abrirDetalle(orden)}
                            title="Ver dirección, proyectos, despiece y fotos"
                            aria-label="Ver detalle de la orden"
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                          >
                            <Eye size={14} />
                          </button>
                          {(permisos.puedeAdministrar || permisos.esJefe) && (
                            <button
                              type="button"
                              onClick={() => abrirEditar(orden)}
                              title="Editar orden y proyectos"
                              aria-label="Editar orden"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {permisos.esAdmin && (
                            <button
                              type="button"
                              onClick={() => eliminarOrden(orden)}
                              title="Eliminar orden"
                              aria-label="Eliminar orden"
                              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
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

      {/* Modal nueva / editar orden */}
      <Modal
        abierto={modalOrden}
        onClose={() => setModalOrden(false)}
        icono={<PackageCheck size={20} />}
        titulo={ordenEditando ? 'Editar Orden' : 'Nueva Orden de Trabajo'}
        subtitulo={
          ordenEditando
            ? 'Datos del cliente y proyectos del trabajo.'
            : 'Registra varios proyectos del mismo cliente y define el destino.'
        }
        ancho="max-w-3xl"
      >
        <form onSubmit={handleGuardarOrden} className="space-y-5">
          {errorForm && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" />
              {errorForm}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="orden-cliente" className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre del Cliente <span className="text-red-400">*</span>
              </label>
              <input
                id="orden-cliente"
                type="text"
                value={form.nombreCliente}
                onChange={(evento) => actualizarCampo('nombreCliente', evento.target.value)}
                placeholder="Ej. Juan Carlos Mosquera"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="orden-telefono" className="block text-xs font-semibold text-slate-300 mb-1">
                Teléfono del Cliente
              </label>
              <input
                id="orden-telefono"
                type="tel"
                value={form.telefonoCliente}
                onChange={(evento) => actualizarCampo('telefonoCliente', evento.target.value)}
                placeholder="Ej. 3110000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="orden-direccion"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Dirección del cliente / establecimiento <span className="text-red-400">*</span>
              </label>
              <input
                id="orden-direccion"
                type="text"
                value={form.direccionCliente}
                onChange={(evento) => actualizarCampo('direccionCliente', evento.target.value)}
                placeholder="Ej. Calle 25 # 4-32, local 2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="orden-barrio" className="block text-xs font-semibold text-slate-300 mb-1">
                Barrio / Sector (opcional)
              </label>
              <input
                id="orden-barrio"
                type="text"
                value={form.barrioCliente}
                onChange={(evento) => actualizarCampo('barrioCliente', evento.target.value)}
                placeholder="Ej. Centro, La Yesquita, Cristo Rey"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {!ordenEditando && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">¿Qué debe pasar con esta orden?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => actualizarCampo('destino', 'medicion')}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    form.destino === 'medicion'
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <Ruler size={15} className="text-amber-400" /> Enviar a medir
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    El instalador toma medidas en terreno y luego el jefe cotiza.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => actualizarCampo('destino', 'produccion')}
                  className={`text-left rounded-2xl border p-4 transition-all ${
                    form.destino === 'produccion'
                      ? 'border-orange-500/60 bg-orange-500/10'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <Factory size={15} className="text-orange-400" /> Pasar directo a producción
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    Ya tienes las medidas: se calcula el despiece y el taller recibe el trabajo.
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-white">Proyectos de esta orden</p>
                <p className="text-[10px] text-slate-500">
                  Puedes cargar varias ventanas, puertas o espacios para el mismo cliente.
                </p>
              </div>
              <button
                type="button"
                onClick={agregarItem}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px]"
              >
                <Plus size={14} /> Agregar proyecto
              </button>
            </div>

            {form.items.map((item, indice) => (
              <div
                key={item.key}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-cyan-400">Proyecto {indice + 1}</p>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarItem(item.key)}
                      aria-label="Quitar proyecto"
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={`item-descripcion-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Descripción del proyecto
                    </label>
                    <input
                      id={`item-descripcion-${item.key}`}
                      type="text"
                      value={item.descripcion}
                      onChange={(evento) =>
                        actualizarItem(item.key, 'descripcion', evento.target.value)
                      }
                      placeholder="Ej. Ventana corrediza sala, puerta baño..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`item-sistema-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Sistema / receta
                    </label>
                    <select
                      id={`item-sistema-${item.key}`}
                      value={item.sistemaId}
                      onChange={(evento) =>
                        actualizarItem(item.key, 'sistemaId', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Sin sistema (solo referencia)</option>
                      {sistemas.map((sistema) => (
                        <option key={sistema.id} value={sistema.id}>
                          {sistema.nombre} · {sistema.linea}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label
                      htmlFor={`item-ancho-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Ancho (cm) *
                    </label>
                    <input
                      id={`item-ancho-${item.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.ancho}
                      onChange={(evento) => actualizarItem(item.key, 'ancho', evento.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`item-alto-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Alto (cm) *
                    </label>
                    <input
                      id={`item-alto-${item.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.alto}
                      onChange={(evento) => actualizarItem(item.key, 'alto', evento.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`item-cantidad-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Cantidad
                    </label>
                    <input
                      id={`item-cantidad-${item.key}`}
                      type="number"
                      min="1"
                      step="1"
                      value={item.cantidad}
                      onChange={(evento) =>
                        actualizarItem(item.key, 'cantidad', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`item-color-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Color del perfil
                    </label>
                    <select
                      id={`item-color-${item.key}`}
                      value={item.color}
                      onChange={(evento) => actualizarItem(item.key, 'color', evento.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {COLORES_PERFIL.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor={`item-vidrio-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Tipo de vidrio
                    </label>
                    <select
                      id={`item-vidrio-${item.key}`}
                      value={item.vidrioTipo}
                      onChange={(evento) =>
                        actualizarItem(item.key, 'vidrioTipo', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {TIPOS_VIDRIO.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {tipo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`item-espesor-${item.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Espesor del vidrio
                    </label>
                    <select
                      id={`item-espesor-${item.key}`}
                      value={item.vidrioEspesor}
                      onChange={(evento) =>
                        actualizarItem(item.key, 'vidrioEspesor', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {ESPESORES_VIDRIO.map((espesor) => (
                        <option key={espesor} value={espesor}>
                          {espesor}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`item-observaciones-${item.key}`}
                    className="block text-[10px] text-slate-400 mb-1"
                  >
                    Observaciones del proyecto
                  </label>
                  <textarea
                    id={`item-observaciones-${item.key}`}
                    rows="2"
                    value={item.observaciones}
                    onChange={(evento) =>
                      actualizarItem(item.key, 'observaciones', evento.target.value)
                    }
                    placeholder="Ej. Muro desnivelado, retirar ventana vieja, acceso por el patio..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOrden(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando
                ? 'Guardando...'
                : ordenEditando
                  ? 'Guardar Cambios'
                  : form.destino === 'produccion'
                    ? 'Crear y Enviar a Producción'
                    : 'Crear y Enviar a Medir'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Ficha completa de la orden */}
      <Modal
        abierto={detalle.abierto}
        onClose={cerrarDetalle}
        icono={<Eye size={20} />}
        titulo={ordenDetalle ? `Orden de ${ordenDetalle.cliente_nombre}` : 'Detalle de la orden'}
        subtitulo={
          ordenDetalle
            ? `${ordenDetalle.codigo_orden || 'Sin código'} · ${ordenDetalle.tipo_trabajo || ''}`
            : ''
        }
        ancho="max-w-3xl"
      >
        {ordenDetalle && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                  ESTADO_ESTILO[ordenDetalle.estado] ||
                  'bg-slate-500/10 text-slate-300 border-slate-500/20'
                }`}
              >
                {ordenDetalle.estado || 'Sin estado'}
              </span>
              {ordenDetalle.instalador_nombre && (
                <span className="text-[10px] text-slate-400">
                  Instalador:{' '}
                  <strong className="text-slate-200">{ordenDetalle.instalador_nombre}</strong>
                </span>
              )}
              {ordenDetalle.produccion_nombre && (
                <span className="text-[10px] text-slate-400">
                  Producción:{' '}
                  <strong className="text-cyan-300">{ordenDetalle.produccion_nombre}</strong>
                </span>
              )}
              {permisos.puedeVerProduccion &&
                (itemsDetalle.length > 0 || (despieceDetalle?.items || []).length > 0) && (
                <button
                  type="button"
                  onClick={() => descargarOrdenProduccion(ordenDetalle)}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-xl text-[11px] transition-colors"
                >
                  <Download size={13} /> Descargar orden de producción
                </button>
              )}
            </div>

            <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <MapPin size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-blue-300">
                    Dirección del cliente
                  </p>
                  {ordenDetalle.cliente_direccion ? (
                    <>
                      <p className="text-sm font-semibold text-white mt-1 break-words">
                        {ordenDetalle.cliente_direccion}
                      </p>
                      {ordenDetalle.cliente_barrio && (
                        <p className="text-xs text-slate-300">
                          Barrio: {ordenDetalle.cliente_barrio}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-300 mt-1">
                      Esta orden no tiene dirección registrada. Pide al jefe que la complete.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pl-12">
                {mapaDetalle && (
                  <a
                    href={mapaDetalle}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                  >
                    <ExternalLink size={13} /> Abrir en Google Maps
                  </a>
                )}
                {telDetalle && (
                  <a
                    href={telDetalle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                  >
                    <Phone size={13} /> {ordenDetalle.cliente_telefono}
                  </a>
                )}
              </div>
            </div>

            {itemsDetalle.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                  Proyectos de la orden
                </p>
                <div className="divide-y divide-slate-800 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  {itemsDetalle.map((item, indice) => (
                    <div key={item.id} className="p-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-bold text-white">
                          {indice + 1}. {item.descripcion}
                        </p>
                        <span className="font-mono text-cyan-300 text-[11px]">
                          {Number(item.ancho_cm)} × {Number(item.alto_cm)} cm ·{' '}
                          {item.cantidad} und.
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {item.sistema_nombre || 'Sin sistema'} · {item.vidrio_tipo || 'Vidrio sin definir'}{' '}
                        {item.vidrio_espesor || ''} · Perfil {item.color || 'sin definir'}
                      </p>
                      {item.observaciones && (
                        <p className="text-[10px] text-amber-200/80 mt-1">{item.observaciones}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatoDetalle etiqueta="Medidas tomadas en terreno" className="sm:col-span-2">
                {ordenDetalle.medidas_terreno ? (
                  <span className="font-mono text-emerald-400">{ordenDetalle.medidas_terreno}</span>
                ) : (
                  'Aún no se han enviado medidas.'
                )}
              </DatoDetalle>

              <DatoDetalle etiqueta="Notas del instalador" className="sm:col-span-2">
                {ordenDetalle.notas_medidas || 'Sin notas adicionales.'}
              </DatoDetalle>

              <DatoDetalle etiqueta="Medido por">{ordenDetalle.medido_por || '—'}</DatoDetalle>

              <DatoDetalle etiqueta="Fecha de la medición">
                {formatFechaHora(ordenDetalle.medido_en)}
              </DatoDetalle>

              <DatoDetalle etiqueta="Creada">
                {formatFechaHora(ordenDetalle.creado_en)}
              </DatoDetalle>

              <DatoDetalle etiqueta="Notas de producción">
                {ordenDetalle.notas_produccion || 'Sin notas.'}
              </DatoDetalle>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <DespiecePanel despiece={despieceDetalle} compacto />
            </div>

            {vidriosDetalle.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-sky-400">
                  Medidas de vidrio enviadas por producción
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
                      <tr>
                        <th className="px-3 py-2">Vidrio</th>
                        <th className="px-3 py-2 text-right">Ancho</th>
                        <th className="px-3 py-2 text-right">Alto</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2">Espesor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {vidriosDetalle.map((vidrio) => (
                        <tr key={vidrio.id}>
                          <td className="px-3 py-2">{vidrio.descripcion}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(vidrio.ancho_cm)} cm</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(vidrio.alto_cm)} cm</td>
                          <td className="px-3 py-2 text-right font-mono">{vidrio.cantidad}</td>
                          <td className="px-3 py-2">{vidrio.espesor || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {imagenesDetalle.cargando ? (
              <p className="text-xs text-slate-500">Cargando imágenes...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                    Fotos de referencia
                  </p>
                  {imagenesDetalle.referencia.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {imagenesDetalle.referencia.map(({ ruta, url }) => (
                        <a
                          key={ruta}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950"
                        >
                          <img
                            src={url}
                            alt="Referencia del trabajo"
                            className="w-full h-24 object-cover group-hover:opacity-80 transition-opacity"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Sin fotos de referencia.</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500 mb-2">
                    Producto terminado
                  </p>
                  {imagenesDetalle.terminado.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {imagenesDetalle.terminado.map(({ ruta, url }) => (
                        <a
                          key={ruta}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block group relative rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-950"
                        >
                          <img
                            src={url}
                            alt="Producto terminado"
                            className="w-full h-24 object-cover group-hover:opacity-80 transition-opacity"
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Producción aún no subió la foto del producto terminado.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de medidas con dirección, notas y fotos */}
      <Modal
        abierto={modalMedidas.abierto}
        onClose={cerrarModalMedidas}
        icono={<Ruler size={20} />}
        titulo="Medidas tomadas en terreno"
        subtitulo={
          modalMedidas.orden
            ? `${modalMedidas.orden.cliente_nombre} · ${modalMedidas.orden.tipo_trabajo}`
            : ''
        }
        ancho="max-w-2xl"
      >
        <form onSubmit={guardarMedidas} className="space-y-5">
          {/* Dirección: lo primero que necesita el instalador */}
          <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <MapPin size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider font-bold text-blue-300">
                  Dirección del cliente / establecimiento
                </p>
                {modalMedidas.orden?.cliente_direccion ? (
                  <>
                    <p className="text-sm font-semibold text-white mt-1 break-words">
                      {modalMedidas.orden.cliente_direccion}
                    </p>
                    {modalMedidas.orden.cliente_barrio && (
                      <p className="text-xs text-slate-300">
                        Barrio: {modalMedidas.orden.cliente_barrio}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-amber-300 mt-1">
                    Sin dirección registrada. Pide al jefe que la complete antes de salir.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-12">
              {mapaMedidas && (
                <a
                  href={mapaMedidas}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                >
                  <ExternalLink size={13} /> Abrir ruta en Google Maps
                </a>
              )}
              {telMedidas && (
                <a
                  href={telMedidas}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold transition-colors"
                >
                  <Phone size={13} /> Llamar al cliente
                </a>
              )}
            </div>
          </div>

          {errorMedidas && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMedidas}</span>
            </div>
          )}

          <div>
            <label htmlFor="medidas" className="block text-xs font-semibold text-slate-300 mb-1">
              Cotas y observaciones <span className="text-red-400">*</span>
            </label>
            <textarea
              id="medidas"
              rows="5"
              value={modalMedidas.texto}
              onChange={(evento) =>
                setModalMedidas((prev) => ({ ...prev, texto: evento.target.value }))
              }
              placeholder={'Ej.\nAncho total: 1.80 m\nAlto: 1.20 m\nMarco: 2" blanco\nObservación: muro desnivelado 5 mm'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Al enviar, la orden pasa a “{ESTADOS.COTIZACION_PENDIENTE}” y el jefe recibe el aviso.
            </p>
          </div>

          <div>
            <label
              htmlFor="notas-medidas"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Notas extra (opcional)
            </label>
            <textarea
              id="notas-medidas"
              rows="3"
              value={modalMedidas.notas}
              onChange={(evento) =>
                setModalMedidas((prev) => ({ ...prev, notas: evento.target.value }))
              }
              placeholder="Ej. El cliente pide instalar el sábado. Hay que retirar la ventana vieja. Tercer piso sin ascensor."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Condiciones del sitio, horario, acceso, retiro de material viejo, etc.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="fotos-referencia" className="block text-xs font-semibold text-slate-300">
                Fotos de referencia (opcional)
              </label>
              <span className="text-[10px] text-slate-500">
                {totalFotosMedidas}/{MAX_IMAGENES} · máx. 5 MB c/u
              </span>
            </div>

            <input
              id="fotos-referencia"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={seleccionarImagenes}
              className="sr-only"
            />
            <label
              htmlFor="fotos-referencia"
              className={`flex items-center justify-center gap-2 w-full border border-dashed rounded-xl px-4 py-4 text-xs font-semibold cursor-pointer transition-colors ${
                totalFotosMedidas >= MAX_IMAGENES
                  ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'border-slate-700 text-slate-300 hover:border-blue-500 hover:text-blue-400 bg-slate-950/60'
              }`}
            >
              <ImagePlus size={16} />
              {totalFotosMedidas >= MAX_IMAGENES
                ? 'Límite de imágenes alcanzado'
                : 'Adjuntar fotos del sitio (JPG, PNG o WEBP)'}
            </label>

            {(modalMedidas.existentes.length > 0 || modalMedidas.nuevas.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {modalMedidas.existentes.map((ruta) => {
                  const marcada = modalMedidas.eliminar.includes(ruta);
                  const url = modalMedidas.existentesUrls[ruta];
                  return (
                    <div
                      key={ruta}
                      className={`relative rounded-xl overflow-hidden border bg-slate-950 ${
                        marcada ? 'border-red-500/60 opacity-40' : 'border-slate-800'
                      }`}
                    >
                      {url ? (
                        <img
                          src={url}
                          alt="Referencia ya adjunta"
                          className="w-full h-20 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-20 flex items-center justify-center text-[9px] text-slate-600">
                          Cargando…
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => alternarEliminarExistente(ruta)}
                        title={marcada ? 'Conservar imagen' : 'Quitar imagen'}
                        aria-label={marcada ? 'Conservar imagen' : 'Quitar imagen'}
                        className="absolute top-1 right-1 p-1 rounded-md bg-slate-950/80 text-slate-300 hover:text-white hover:bg-red-600/80"
                      >
                        <X size={12} />
                      </button>
                      {marcada && (
                        <span className="absolute inset-x-0 bottom-0 bg-red-600/80 text-[9px] text-white text-center py-0.5">
                          Se quitará
                        </span>
                      )}
                    </div>
                  );
                })}

                {modalMedidas.nuevas.map((item) => (
                  <div
                    key={item.id}
                    className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950"
                  >
                    <img src={item.preview} alt={item.file.name} className="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarNueva(item.id)}
                      title="Quitar imagen"
                      aria-label="Quitar imagen"
                      className="absolute top-1 right-1 p-1 rounded-md bg-slate-950/80 text-slate-300 hover:text-white hover:bg-red-600/80"
                    >
                      <X size={12} />
                    </button>
                    <span className="absolute inset-x-0 bottom-0 bg-slate-950/80 text-[8px] text-slate-300 text-center py-0.5 truncate px-1">
                      {item.file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-slate-500 mt-2">
              Las fotos se guardan en un bucket privado y solo las ve el equipo del taller.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={devolverABolsa}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <Truck size={14} /> Devolver a la bolsa
            </button>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cerrarModalMedidas}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoMedidas}
                className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 disabled:opacity-50 transition-colors"
              >
                {guardandoMedidas ? 'Enviando...' : 'Enviar Medidas'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de medidas de vidrio */}
      <Modal
        abierto={modalVidrios.abierto}
        onClose={() => setModalVidrios(VIDRIOS_VACIO)}
        icono={<Ruler size={20} />}
        titulo="Medidas de vidrio para el jefe"
        subtitulo={
          modalVidrios.orden
            ? `${modalVidrios.orden.cliente_nombre} · confirma cada medida antes de enviar`
            : ''
        }
        ancho="max-w-3xl"
      >
        <form onSubmit={guardarVidrios} className="space-y-4">
          {modalVidrios.error && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{modalVidrios.error}</span>
            </div>
          )}

          <div className="bg-sky-950/40 border border-sky-500/30 rounded-xl p-3 text-[11px] text-sky-200">
            Estas medidas se calculan con el descuento del sistema. Ajústalas si el vidrio real
            tiene otro corte y envíalas al jefe de taller.
          </div>

          <div className="space-y-2">
            {modalVidrios.filas.map((fila, indice) => (
              <div
                key={fila.key}
                className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-sky-400">Vidrio {indice + 1}</p>
                  {modalVidrios.filas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarFilaVidrio(fila.key)}
                      aria-label="Quitar vidrio"
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2 sm:col-span-4">
                    <label
                      htmlFor={`vidrio-desc-${fila.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Descripción
                    </label>
                    <input
                      id={`vidrio-desc-${fila.key}`}
                      type="text"
                      value={fila.descripcion}
                      onChange={(evento) =>
                        actualizarFilaVidrio(fila.key, 'descripcion', evento.target.value)
                      }
                      placeholder="Ej. Ventana sala · vidrio templado"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`vidrio-ancho-${fila.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Ancho (cm)
                    </label>
                    <input
                      id={`vidrio-ancho-${fila.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={fila.ancho}
                      onChange={(evento) =>
                        actualizarFilaVidrio(fila.key, 'ancho', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`vidrio-alto-${fila.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Alto (cm)
                    </label>
                    <input
                      id={`vidrio-alto-${fila.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={fila.alto}
                      onChange={(evento) =>
                        actualizarFilaVidrio(fila.key, 'alto', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`vidrio-cant-${fila.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Cantidad
                    </label>
                    <input
                      id={`vidrio-cant-${fila.key}`}
                      type="number"
                      min="1"
                      step="1"
                      value={fila.cantidad}
                      onChange={(evento) =>
                        actualizarFilaVidrio(fila.key, 'cantidad', evento.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`vidrio-espesor-${fila.key}`}
                      className="block text-[10px] text-slate-400 mb-1"
                    >
                      Espesor
                    </label>
                    <input
                      id={`vidrio-espesor-${fila.key}`}
                      type="text"
                      value={fila.espesor}
                      onChange={(evento) =>
                        actualizarFilaVidrio(fila.key, 'espesor', evento.target.value)
                      }
                      placeholder="Ej. 6 mm"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  value={fila.observaciones}
                  onChange={(evento) =>
                    actualizarFilaVidrio(fila.key, 'observaciones', evento.target.value)
                  }
                  placeholder="Observaciones del vidrio (opcional)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={agregarFilaVidrio}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px]"
          >
            <Plus size={14} /> Agregar otro vidrio
          </button>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalVidrios(VIDRIOS_VACIO)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={modalVidrios.guardando}
              className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/20 disabled:opacity-50 transition-colors"
            >
              {modalVidrios.guardando ? 'Enviando...' : 'Enviar al jefe'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de producto terminado */}
      <Modal
        abierto={modalTerminado.abierto}
        onClose={cerrarTerminado}
        icono={<Camera size={20} />}
        titulo="Trabajo terminado"
        subtitulo={
          modalTerminado.orden
            ? `${modalTerminado.orden.cliente_nombre} · sube la foto del producto`
            : ''
        }
      >
        <form onSubmit={guardarTerminado} className="space-y-4">
          {modalTerminado.error && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{modalTerminado.error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label
                htmlFor="fotos-terminado"
                className="block text-xs font-semibold text-slate-300"
              >
                Foto del producto terminado <span className="text-red-400">*</span>
              </label>
              <span className="text-[10px] text-slate-500">
                {modalTerminado.archivos.length}/{MAX_IMAGENES}
              </span>
            </div>

            <input
              id="fotos-terminado"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={seleccionarFotosTerminado}
              className="sr-only"
            />
            <label
              htmlFor="fotos-terminado"
              className="flex items-center justify-center gap-2 w-full border border-dashed rounded-xl px-4 py-5 text-xs font-semibold cursor-pointer transition-colors border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-emerald-400 bg-slate-950/60"
            >
              <Camera size={16} /> Tomar o subir foto (JPG, PNG o WEBP)
            </label>

            {modalTerminado.archivos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {modalTerminado.archivos.map((item) => (
                  <div
                    key={item.id}
                    className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950"
                  >
                    <img src={item.preview} alt={item.file.name} className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => quitarFotoTerminado(item.id)}
                      aria-label="Quitar foto"
                      className="absolute top-1 right-1 p-1 rounded-md bg-slate-950/80 text-slate-300 hover:text-white hover:bg-red-600/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="notas-terminado"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Notas de producción (opcional)
            </label>
            <textarea
              id="notas-terminado"
              rows="3"
              value={modalTerminado.notas}
              onChange={(evento) =>
                setModalTerminado((prev) => ({ ...prev, notas: evento.target.value }))
              }
              placeholder="Ej. Se ajustó el cierre, quedó sellado. Listo para instalar."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={cerrarTerminado}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={modalTerminado.guardando}
              className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/20 disabled:opacity-50 transition-colors"
            >
              {modalTerminado.guardando ? 'Guardando...' : 'Marcar Terminado'}
            </button>
          </div>
        </form>
      </Modal>

      {!permisos.puedeCrearOrden && permisos.puedeInstalar && resumen.pendientes === 0 && !cargando && (
        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <CheckCircle2 size={14} className="text-emerald-500" />
          No hay órdenes nuevas en la bolsa de instaladores.
        </p>
      )}
    </div>
  );
}
