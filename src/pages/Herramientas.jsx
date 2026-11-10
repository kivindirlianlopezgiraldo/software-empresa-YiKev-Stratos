import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Edit2,
  HardHat,
  History,
  Package,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  Wrench,
  X,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { imprimirActaHerramientas } from '../lib/actaHerramientas';
import { CATEGORIAS_HERRAMIENTA, ESTADOS_HERRAMIENTA, categoriaRol } from '../lib/constants';
import { formatFechaHora, nuevoId } from '../lib/format';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import useToast from '../hooks/useToast';
import useConfirm from '../hooks/useConfirm';

const FORM_HERRAMIENTA = {
  nombre: '',
  codigo: '',
  categoria: CATEGORIAS_HERRAMIENTA[0],
  estado: ESTADOS_HERRAMIENTA[0],
  descripcion: '',
  colaboradorId: '',
  notas: '',
};

const FORM_CHECKLIST = {
  nombre: '',
  tipo: 'salida',
  items: '',
};

const FORM_REGISTRO = {
  tipo: 'salida',
  plantillaId: '',
  colaboradorId: '',
  marcados: [],
  novedad: '',
};

const FORM_SALIDA = {
  colaboradorId: '',
  herramientaIds: [],
  ordenId: '',
  plantillaId: '',
  kitId: '',
  marcados: [],
  novedad: '',
};

const FORM_ENTRADA = {
  colaboradorId: '',
  herramientaIds: [],
  plantillaId: '',
  marcados: [],
  novedad: '',
};

const FORM_KIT = {
  nombre: '',
  rolDestino: 'instalador',
  descripcion: '',
  items: '',
};

const ETIQUETAS_ROL = {
  produccion: 'Producción',
  instalador: 'Instalación',
  bodega: 'Bodega',
  otro: 'General',
};

// Compara nombres sin tildes ni mayúsculas para que "Taladro" encuentre
// "Taladro percutor Bosch" y "Nivel" encuentre "Nivel láser".
function normalizarTexto(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function explicarError(err) {
  const texto = err?.message || '';
  if (/herramienta|checklist|inventario_produccion|columna|relation|does not exist/i.test(texto)) {
    return (
      'Falta aplicar la migración 005 en Supabase (herramientas, checklists y producción). ' +
      'Ejecuta supabase/migrations/005_produccion_herramientas_ia.sql en el SQL Editor. ' +
      `Detalle: ${texto}`
    );
  }
  return texto;
}

function EstadoBadge({ estado }) {
  const estilos = {
    Disponible: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Asignada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'En uso': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    Mantenimiento: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Perdida: 'bg-red-500/10 text-red-400 border-red-500/20',
    Dañada: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return (
    <span
      className={`px-2 py-1 rounded-md text-[10px] font-bold border whitespace-nowrap ${
        estilos[estado] || 'bg-slate-500/10 text-slate-300 border-slate-500/20'
      }`}
    >
      {estado}
    </span>
  );
}

export default function Herramientas({ perfil, permisos }) {
  const [herramientas, setHerramientas] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [tab, setTab] = useState('herramientas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  const [modalHerramienta, setModalHerramienta] = useState(false);
  const [herramientaEditando, setHerramientaEditando] = useState(null);
  const [formHerramienta, setFormHerramienta] = useState(FORM_HERRAMIENTA);
  const [errorHerramienta, setErrorHerramienta] = useState('');

  const [modalChecklist, setModalChecklist] = useState(false);
  const [checklistEditando, setChecklistEditando] = useState(null);
  const [formChecklist, setFormChecklist] = useState(FORM_CHECKLIST);

  const [modalRegistro, setModalRegistro] = useState(false);
  const [formRegistro, setFormRegistro] = useState(FORM_REGISTRO);
  const [errorRegistro, setErrorRegistro] = useState('');

  const [movimientos, setMovimientos] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [kits, setKits] = useState([]);
  const [empresa, setEmpresa] = useState(null);

  const [modalKit, setModalKit] = useState(false);
  const [kitEditando, setKitEditando] = useState(null);
  const [formKit, setFormKit] = useState(FORM_KIT);
  const [errorKit, setErrorKit] = useState('');

  const [modalSalida, setModalSalida] = useState(false);
  const [formSalida, setFormSalida] = useState(FORM_SALIDA);
  const [errorSalida, setErrorSalida] = useState('');

  const [modalEntrada, setModalEntrada] = useState(false);
  const [formEntrada, setFormEntrada] = useState(FORM_ENTRADA);
  const [errorEntrada, setErrorEntrada] = useState('');

  const [guardando, setGuardando] = useState(false);
  const { alerta, mostrar, cerrar } = useToast();
  const confirmar = useConfirm();

  const puedeAsignar = permisos?.puedeAsignarHerramientas;
  const puedeUsar = permisos?.puedeUsarChecklists;

  const consultar = useCallback(async () => {
    const [
      resHerramientas,
      resPlantillas,
      resRegistros,
      resColaboradores,
      resMovimientos,
      resOrdenes,
      resKits,
      resEmpresa,
    ] = await Promise.all([
        supabase.from('herramientas').select('*').order('nombre', { ascending: true }),
        supabase.from('herramienta_checklists').select('*').order('nombre', { ascending: true }),
        supabase
          .from('herramienta_registros')
          .select('*')
          .order('creado_en', { ascending: false })
          .limit(120),
        supabase
          .from('perfiles_usuario')
          .select('id, nombre_completo, documento_id, rol, cargo, activo')
          .order('nombre_completo', { ascending: true }),
        supabase
          .from('herramienta_movimientos')
          .select('*')
          .order('creado_en', { ascending: false })
          .limit(300),
        supabase
          .from('ordenes_trabajo')
          .select('id, codigo_orden, cliente_nombre, estado')
          .order('creado_en', { ascending: false })
          .limit(80),
        supabase.from('herramienta_kits').select('*').order('nombre', { ascending: true }),
        supabase.from('empresa_config').select('*').limit(1),
      ]);

    if (resHerramientas.error) throw resHerramientas.error;

    return {
      herramientas: resHerramientas.data ?? [],
      plantillas: resPlantillas.error ? [] : resPlantillas.data ?? [],
      registros: resRegistros.error ? [] : resRegistros.data ?? [],
      colaboradores: resColaboradores.error ? [] : resColaboradores.data ?? [],
      movimientos: resMovimientos.error ? [] : resMovimientos.data ?? [],
      ordenes: resOrdenes.error ? [] : resOrdenes.data ?? [],
      kits: resKits.error ? [] : resKits.data ?? [],
      empresa: resEmpresa.error ? null : (resEmpresa.data ?? [])[0] ?? null,
    };
  }, []);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const datos = await consultar();
        if (!activo) return;
        setHerramientas(datos.herramientas);
        setPlantillas(datos.plantillas);
        setRegistros(datos.registros);
        setColaboradores(datos.colaboradores.filter((c) => c.activo !== false));
        setMovimientos(datos.movimientos);
        setOrdenes(datos.ordenes);
        setKits(datos.kits);
        setEmpresa(datos.empresa);
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

  const abrirNuevaHerramienta = () => {
    setHerramientaEditando(null);
    setFormHerramienta(FORM_HERRAMIENTA);
    setErrorHerramienta('');
    setModalHerramienta(true);
  };

  const abrirEditarHerramienta = (herramienta) => {
    setHerramientaEditando(herramienta);
    setFormHerramienta({
      nombre: herramienta.nombre || '',
      codigo: herramienta.codigo || '',
      categoria: herramienta.categoria || CATEGORIAS_HERRAMIENTA[0],
      estado: herramienta.estado || ESTADOS_HERRAMIENTA[0],
      descripcion: herramienta.descripcion || '',
      colaboradorId: herramienta.colaborador_id || '',
      notas: herramienta.notas || '',
    });
    setErrorHerramienta('');
    setModalHerramienta(true);
  };

  const guardarHerramienta = async (evento) => {
    evento.preventDefault();
    const nombre = formHerramienta.nombre.trim();
    if (!nombre) {
      setErrorHerramienta('El nombre de la herramienta es obligatorio.');
      return;
    }

    setGuardando(true);
    setErrorHerramienta('');

    try {
      const colaborador = colaboradores.find((c) => c.id === formHerramienta.colaboradorId);
      const asignada = Boolean(colaborador);

      const payload = {
        nombre,
        codigo: formHerramienta.codigo.trim() || null,
        categoria: formHerramienta.categoria,
        estado: asignada
          ? formHerramienta.estado === ESTADOS_HERRAMIENTA[0]
            ? 'Asignada'
            : formHerramienta.estado
          : formHerramienta.estado,
        descripcion: formHerramienta.descripcion.trim() || null,
        colaborador_id: colaborador?.id ?? null,
        colaborador_nombre: colaborador?.nombre_completo ?? null,
        asignado_por: asignada ? perfil?.id ?? null : null,
        asignado_por_nombre: asignada ? perfil?.nombre_completo ?? null : null,
        asignado_en: asignada ? new Date().toISOString() : null,
        notas: formHerramienta.notas.trim() || null,
        actualizado_en: new Date().toISOString(),
      };

      if (herramientaEditando) {
        const { error: errorUpdate } = await supabase
          .from('herramientas')
          .update(payload)
          .eq('id', herramientaEditando.id);
        if (errorUpdate) throw errorUpdate;
        mostrar('Herramienta actualizada', 'Los datos quedaron guardados.', 'exito');
      } else {
        const { error: errorInsert } = await supabase
          .from('herramientas')
          .insert([{ id: nuevoId(), ...payload }]);
        if (errorInsert) throw errorInsert;
        mostrar(
          'Herramienta registrada',
          asignada
            ? `Quedó asignada a ${colaborador.nombre_completo}.`
            : 'Ya está disponible en el catálogo.',
          'exito',
        );
      }

      setModalHerramienta(false);
      refrescar();
    } catch (err) {
      setErrorHerramienta(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const devolverHerramienta = async (herramienta) => {
    try {
      const ahora = new Date().toISOString();
      const { error: errorUpdate } = await supabase
        .from('herramientas')
        .update({
          colaborador_id: null,
          colaborador_nombre: null,
          asignado_por: null,
          asignado_por_nombre: null,
          asignado_en: null,
          estado: 'Disponible',
          actualizado_en: ahora,
        })
        .eq('id', herramienta.id);
      if (errorUpdate) throw errorUpdate;

      // El historial es opcional: si falta la migración 006 no bloquea la devolución.
      if (herramienta.colaborador_id) {
        await supabase.from('herramienta_movimientos').insert([
          {
            id: nuevoId(),
            herramienta_id: herramienta.id,
            herramienta_nombre: herramienta.nombre,
            herramienta_codigo: herramienta.codigo,
            colaborador_id: herramienta.colaborador_id,
            colaborador_nombre: herramienta.colaborador_nombre,
            tipo: 'entrada',
            estado_anterior: herramienta.estado,
            estado_nuevo: 'Disponible',
            registrado_por: perfil?.id ?? null,
            registrado_por_nombre: perfil?.nombre_completo ?? null,
          },
        ]);
      }

      mostrar('Herramienta devuelta', 'Volvió a estar disponible en el taller.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo devolver', explicarError(err));
    }
  };

  const eliminarHerramienta = async (herramienta) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar herramienta',
      mensaje: `¿Eliminar la herramienta "${herramienta.nombre}" del catálogo?`,
      confirmarTexto: 'Eliminar herramienta',
    });
    if (!confirmado) return;
    try {
      const { error: errorDelete } = await supabase
        .from('herramientas')
        .delete()
        .eq('id', herramienta.id);
      if (errorDelete) throw errorDelete;
      mostrar('Herramienta eliminada', 'Se quitó del catálogo.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo eliminar', explicarError(err));
    }
  };

  // ---------------------------------------------------------------------------
  // Salidas y entradas de herramientas (actas por lote)
  // ---------------------------------------------------------------------------
  const registrarActa = async ({ tipo, colaborador, seleccionadas, plantilla, marcados, novedad }) => {
    const registroId = nuevoId();
    const items = (plantilla?.items || []).map((texto, indice) => ({
      texto,
      marcado: marcados.includes(indice),
    }));

    const { error } = await supabase.from('herramienta_registros').insert([
      {
        id: registroId,
        colaborador_id: colaborador.id,
        colaborador_nombre: colaborador.nombre_completo,
        checklist_id: plantilla?.id ?? null,
        checklist_nombre:
          plantilla?.nombre ??
          (tipo === 'salida' ? 'Salida de herramientas' : 'Entrada de herramientas'),
        tipo,
        items,
        herramientas: seleccionadas.map((h) => ({
          id: h.id,
          nombre: h.nombre,
          codigo: h.codigo,
        })),
        novedad: novedad || null,
      },
    ]);
    if (error) throw error;
    return registroId;
  };

  const registrarMovimientos = async ({
    tipo,
    colaborador,
    seleccionadas,
    loteId,
    registroId,
    ordenId,
    novedad,
    estadoNuevo,
  }) => {
    const filas = seleccionadas.map((h) => ({
      id: nuevoId(),
      lote_id: loteId,
      herramienta_id: h.id,
      herramienta_nombre: h.nombre,
      herramienta_codigo: h.codigo,
      colaborador_id: colaborador.id,
      colaborador_nombre: colaborador.nombre_completo,
      tipo,
      estado_anterior: h.estado,
      estado_nuevo: estadoNuevo,
      orden_id: ordenId || null,
      registro_id: registroId,
      novedad: novedad || null,
      registrado_por: perfil?.id ?? null,
      registrado_por_nombre: perfil?.nombre_completo ?? null,
    }));

    const { error } = await supabase.from('herramienta_movimientos').insert(filas);
    if (error) throw error;
  };

  const abrirSalida = () => {
    setFormSalida(FORM_SALIDA);
    setErrorSalida('');
    setModalSalida(true);
  };

  const guardarSalida = async (evento) => {
    evento.preventDefault();
    const colaborador = colaboradores.find((c) => c.id === formSalida.colaboradorId);
    const seleccionadas = herramientas.filter((h) =>
      formSalida.herramientaIds.includes(h.id),
    );

    if (!colaborador) {
      setErrorSalida('Selecciona el colaborador que recibe las herramientas.');
      return;
    }
    if (!seleccionadas.length) {
      setErrorSalida('Marca al menos una herramienta de la lista.');
      return;
    }

    const plantilla = plantillas.find((p) => p.id === formSalida.plantillaId) || null;
    const novedad = formSalida.novedad.trim();
    const loteId = nuevoId();
    const ahora = new Date().toISOString();

    setGuardando(true);
    setErrorSalida('');
    let registroId = null;

    try {
      registroId = await registrarActa({
        tipo: 'salida',
        colaborador,
        seleccionadas,
        plantilla,
        marcados: formSalida.marcados,
        novedad,
      });

      const { error: errorUpdate } = await supabase
        .from('herramientas')
        .update({
          estado: 'Asignada',
          colaborador_id: colaborador.id,
          colaborador_nombre: colaborador.nombre_completo,
          asignado_por: perfil?.id ?? null,
          asignado_por_nombre: perfil?.nombre_completo ?? null,
          asignado_en: ahora,
          actualizado_en: ahora,
        })
        .in(
          'id',
          seleccionadas.map((h) => h.id),
        );
      if (errorUpdate) throw errorUpdate;

      await registrarMovimientos({
        tipo: 'salida',
        colaborador,
        seleccionadas,
        loteId,
        registroId,
        ordenId: formSalida.ordenId || null,
        novedad,
        estadoNuevo: 'Asignada',
      });

      setModalSalida(false);
      mostrar(
        'Salida registrada',
        `${seleccionadas.length} herramienta(s) entregada(s) a ${colaborador.nombre_completo}.`,
        'exito',
      );
      refrescar();
    } catch (err) {
      if (registroId) {
        await supabase.from('herramienta_registros').delete().eq('id', registroId);
      }
      setErrorSalida(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const abrirEntrada = () => {
    setFormEntrada(FORM_ENTRADA);
    setErrorEntrada('');
    setModalEntrada(true);
  };

  const guardarEntrada = async (evento) => {
    evento.preventDefault();
    const colaborador = colaboradores.find((c) => c.id === formEntrada.colaboradorId);
    const asignadas = herramientas.filter((h) => h.colaborador_id === colaborador?.id);
    const seleccionadas = asignadas.filter((h) => formEntrada.herramientaIds.includes(h.id));

    if (!colaborador) {
      setErrorEntrada('Selecciona el colaborador que devuelve las herramientas.');
      return;
    }
    if (!asignadas.length) {
      setErrorEntrada(`${colaborador.nombre_completo} no tiene herramientas asignadas.`);
      return;
    }
    if (!seleccionadas.length) {
      setErrorEntrada('Marca al menos una herramienta para devolver.');
      return;
    }

    const plantilla = plantillas.find((p) => p.id === formEntrada.plantillaId) || null;
    const novedad = formEntrada.novedad.trim();
    const loteId = nuevoId();
    const ahora = new Date().toISOString();

    setGuardando(true);
    setErrorEntrada('');
    let registroId = null;

    try {
      registroId = await registrarActa({
        tipo: 'entrada',
        colaborador,
        seleccionadas,
        plantilla,
        marcados: formEntrada.marcados,
        novedad,
      });

      const { error: errorUpdate } = await supabase
        .from('herramientas')
        .update({
          estado: 'Disponible',
          colaborador_id: null,
          colaborador_nombre: null,
          asignado_por: null,
          asignado_por_nombre: null,
          asignado_en: null,
          actualizado_en: ahora,
        })
        .in(
          'id',
          seleccionadas.map((h) => h.id),
        );
      if (errorUpdate) throw errorUpdate;

      await registrarMovimientos({
        tipo: 'entrada',
        colaborador,
        seleccionadas,
        loteId,
        registroId,
        ordenId: null,
        novedad,
        estadoNuevo: 'Disponible',
      });

      setModalEntrada(false);
      mostrar(
        'Entrada registrada',
        `${seleccionadas.length} herramienta(s) devuelta(s) por ${colaborador.nombre_completo}.`,
        'exito',
      );
      refrescar();
    } catch (err) {
      if (registroId) {
        await supabase.from('herramienta_registros').delete().eq('id', registroId);
      }
      setErrorEntrada(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevoKit = () => {
    setKitEditando(null);
    setFormKit(FORM_KIT);
    setErrorKit('');
    setModalKit(true);
  };

  const abrirEditarKit = (kit) => {
    setKitEditando(kit);
    setFormKit({
      nombre: kit.nombre || '',
      rolDestino: kit.rol_destino || 'instalador',
      descripcion: kit.descripcion || '',
      items: (kit.items || [])
        .map((item) => {
          const nombre = item?.nombre ?? String(item ?? '');
          const cantidad = Number(item?.cantidad) || 1;
          return cantidad > 1 ? `${nombre} | ${cantidad}` : nombre;
        })
        .join('\n'),
    });
    setErrorKit('');
    setModalKit(true);
  };

  const guardarKit = async (evento) => {
    evento.preventDefault();
    const nombre = formKit.nombre.trim();
    if (!nombre) {
      setErrorKit('El nombre del kit es obligatorio.');
      return;
    }

    const items = formKit.items
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean)
      .map((linea) => {
        const [nombreItem, cantidadTexto] = linea.split('|');
        return {
          nombre: (nombreItem || '').trim(),
          cantidad: Math.max(1, Math.round(Number(cantidadTexto) || 1)),
        };
      })
      .filter((item) => item.nombre);

    if (!items.length) {
      setErrorKit('Agrega al menos una herramienta al kit.');
      return;
    }

    setGuardando(true);
    setErrorKit('');

    try {
      const payload = {
        nombre,
        rol_destino: formKit.rolDestino,
        descripcion: formKit.descripcion.trim() || null,
        items,
        actualizado_en: new Date().toISOString(),
      };

      if (kitEditando) {
        const { error } = await supabase
          .from('herramienta_kits')
          .update(payload)
          .eq('id', kitEditando.id);
        if (error) throw error;
        mostrar('Kit actualizado', 'Las herramientas del kit quedaron guardadas.', 'exito');
      } else {
        const { error } = await supabase
          .from('herramienta_kits')
          .insert([{ id: nuevoId(), ...payload }]);
        if (error) throw error;
        mostrar('Kit creado', 'Ya está disponible al registrar una salida.', 'exito');
      }

      setModalKit(false);
      refrescar();
    } catch (err) {
      setErrorKit(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarKit = async (kit) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar kit',
      mensaje: `¿Eliminar el kit "${kit.nombre}"?`,
      confirmarTexto: 'Eliminar kit',
    });
    if (!confirmado) return;
    try {
      const { error } = await supabase.from('herramienta_kits').delete().eq('id', kit.id);
      if (error) throw error;
      mostrar('Kit eliminado', 'Se quitó de las plantillas por rol.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo eliminar', explicarError(err));
    }
  };

  const aplicarKit = (kitId) => {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;

    const disponibles = herramientas
      .filter(
        (h) =>
          !h.colaborador_id &&
          !['Mantenimiento', 'Perdida', 'Dañada'].includes(h.estado),
      )
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

    const usadas = new Set();
    const elegidas = [];
    const faltantes = [];

    (kit.items || []).forEach((item) => {
      const buscado = normalizarTexto(item?.nombre ?? item);
      const cantidad = Math.max(1, Math.round(Number(item?.cantidad) || 1));
      if (!buscado) return;

      let encontradas = 0;
      for (const herramienta of disponibles) {
        if (usadas.has(herramienta.id)) continue;
        if (normalizarTexto(herramienta.nombre).includes(buscado)) {
          usadas.add(herramienta.id);
          elegidas.push(herramienta.id);
          encontradas += 1;
          if (encontradas >= cantidad) break;
        }
      }

      if (encontradas < cantidad) {
        const etiqueta = item?.nombre ?? item;
        faltantes.push(
          cantidad > 1 ? `${etiqueta} (${encontradas}/${cantidad})` : String(etiqueta),
        );
      }
    });

    setFormSalida((prev) => ({ ...prev, kitId, herramientaIds: elegidas }));

    if (!elegidas.length) {
      mostrar(
        'Sin herramientas del kit',
        faltantes.length
          ? `No hay disponibles: ${faltantes.join(', ')}.`
          : 'El kit no tiene herramientas configuradas.',
      );
    } else if (faltantes.length) {
      mostrar(
        'Kit aplicado parcialmente',
        `Marcadas ${elegidas.length}. Faltan: ${faltantes.join(', ')}.`,
      );
    } else {
      mostrar('Kit aplicado', `${elegidas.length} herramienta(s) marcadas.`, 'exito');
    }
  };

  const abrirNuevoChecklist = () => {
    setChecklistEditando(null);
    setFormChecklist(FORM_CHECKLIST);
    setModalChecklist(true);
  };

  const abrirEditarChecklist = (plantilla) => {
    setChecklistEditando(plantilla);
    setFormChecklist({
      nombre: plantilla.nombre || '',
      tipo: plantilla.tipo || 'salida',
      items: (plantilla.items || []).join('\n'),
    });
    setModalChecklist(true);
  };

  const guardarChecklist = async (evento) => {
    evento.preventDefault();
    const nombre = formChecklist.nombre.trim();
    if (!nombre) return;

    const items = formChecklist.items
      .split('\n')
      .map((linea) => linea.trim())
      .filter(Boolean);

    if (!items.length) {
      mostrar('Checklist vacío', 'Agrega al menos un punto de verificación.');
      return;
    }

    setGuardando(true);
    try {
      const payload = { nombre, tipo: formChecklist.tipo, items };

      if (checklistEditando) {
        const { error: errorUpdate } = await supabase
          .from('herramienta_checklists')
          .update(payload)
          .eq('id', checklistEditando.id);
        if (errorUpdate) throw errorUpdate;
        mostrar('Checklist actualizado', 'Los puntos de verificación quedaron guardados.', 'exito');
      } else {
        const { error: errorInsert } = await supabase
          .from('herramienta_checklists')
          .insert([{ id: nuevoId(), ...payload }]);
        if (errorInsert) throw errorInsert;
        mostrar('Checklist creado', 'Ya está disponible para las salidas y entradas.', 'exito');
      }

      setModalChecklist(false);
      refrescar();
    } catch (err) {
      mostrar('No se pudo guardar', explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const eliminarChecklist = async (plantilla) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar checklist',
      mensaje: `¿Eliminar el checklist "${plantilla.nombre}"?`,
      confirmarTexto: 'Eliminar checklist',
    });
    if (!confirmado) return;
    try {
      const { error: errorDelete } = await supabase
        .from('herramienta_checklists')
        .delete()
        .eq('id', plantilla.id);
      if (errorDelete) throw errorDelete;
      mostrar('Checklist eliminado', 'Se quitó de las plantillas.', 'exito');
      refrescar();
    } catch (err) {
      mostrar('No se pudo eliminar', explicarError(err));
    }
  };

  const abrirRegistro = (tipo = 'salida') => {
    const plantilla = plantillas.find((p) => p.tipo === tipo) || null;
    setFormRegistro({
      ...FORM_REGISTRO,
      tipo,
      plantillaId: plantilla?.id || '',
      colaboradorId: permisos?.esProduccion || permisos?.esInstalador ? perfil?.id || '' : '',
      marcados: [],
    });
    setErrorRegistro('');
    setModalRegistro(true);
  };

  const plantillaRegistro = useMemo(
    () => plantillas.find((p) => p.id === formRegistro.plantillaId) || null,
    [plantillas, formRegistro.plantillaId],
  );

  const cambiarTipoRegistro = (tipo) => {
    const plantilla = plantillas.find((p) => p.tipo === tipo) || null;
    setFormRegistro((prev) => ({
      ...prev,
      tipo,
      plantillaId: plantilla?.id || '',
      marcados: [],
    }));
  };

  const guardarRegistro = async (evento) => {
    evento.preventDefault();
    if (!formRegistro.colaboradorId) {
      setErrorRegistro('Selecciona el colaborador que firma el checklist.');
      return;
    }
    if (!plantillaRegistro) {
      setErrorRegistro('Selecciona una plantilla de checklist.');
      return;
    }

    setGuardando(true);
    setErrorRegistro('');

    try {
      const colaborador = colaboradores.find((c) => c.id === formRegistro.colaboradorId);
      const items = (plantillaRegistro.items || []).map((texto, indice) => ({
        texto,
        marcado: formRegistro.marcados.includes(indice),
      }));

      const { error: errorInsert } = await supabase.from('herramienta_registros').insert([
        {
          id: nuevoId(),
          colaborador_id: formRegistro.colaboradorId,
          colaborador_nombre: colaborador?.nombre_completo ?? null,
          checklist_id: plantillaRegistro.id,
          checklist_nombre: plantillaRegistro.nombre,
          tipo: plantillaRegistro.tipo,
          items,
          novedad: formRegistro.novedad.trim() || null,
        },
      ]);
      if (errorInsert) throw errorInsert;

      setModalRegistro(false);
      mostrar(
        'Checklist firmado',
        formRegistro.tipo === 'salida'
          ? 'El colaborador salió con la verificación registrada.'
          : 'La entrada al taller quedó registrada.',
        'exito',
      );
      refrescar();
    } catch (err) {
      setErrorRegistro(explicarError(err));
    } finally {
      setGuardando(false);
    }
  };

  const filtradas = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();
    return herramientas.filter((herramienta) => {
      const coincideEstado = filtroEstado === 'TODOS' || herramienta.estado === filtroEstado;
      if (!coincideEstado) return false;
      if (!texto) return true;
      return [herramienta.nombre, herramienta.codigo, herramienta.categoria, herramienta.colaborador_nombre]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto));
    });
  }, [herramientas, busqueda, filtroEstado]);

  const resumen = useMemo(
    () => ({
      total: herramientas.length,
      disponibles: herramientas.filter((h) => h.estado === 'Disponible').length,
      asignadas: herramientas.filter((h) => h.colaborador_id).length,
      novedades: registros.filter((r) => r.novedad).length,
    }),
    [herramientas, registros],
  );

  const disponiblesSalida = useMemo(
    () =>
      herramientas
        .filter(
          (h) =>
            !h.colaborador_id &&
            !['Mantenimiento', 'Perdida', 'Dañada'].includes(h.estado),
        )
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
    [herramientas],
  );

  const asignadasEntrada = useMemo(
    () =>
      herramientas
        .filter((h) => formEntrada.colaboradorId && h.colaborador_id === formEntrada.colaboradorId)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es')),
    [herramientas, formEntrada.colaboradorId],
  );

  const plantillaSalida = useMemo(
    () => plantillas.find((p) => p.id === formSalida.plantillaId) || null,
    [plantillas, formSalida.plantillaId],
  );

  const plantillaEntrada = useMemo(
    () => plantillas.find((p) => p.id === formEntrada.plantillaId) || null,
    [plantillas, formEntrada.plantillaId],
  );

  const kitsSalida = useMemo(() => {
    const colaborador = colaboradores.find((c) => c.id === formSalida.colaboradorId);
    if (!colaborador) return kits;
    const categoria = categoriaRol(colaborador.rol);
    return kits.filter(
      (kit) => kit.rol_destino === categoria || kit.rol_destino === 'otro',
    );
  }, [kits, colaboradores, formSalida.colaboradorId]);

  const lotes = useMemo(() => {
    const mapa = new Map();
    movimientos.forEach((movimiento) => {
      const clave = movimiento.lote_id || movimiento.id;
      if (!mapa.has(clave)) {
        mapa.set(clave, {
          id: clave,
          tipo: movimiento.tipo,
          colaborador_id: movimiento.colaborador_id,
          colaborador_nombre: movimiento.colaborador_nombre,
          creado_en: movimiento.creado_en,
          registrado_por_nombre: movimiento.registrado_por_nombre,
          novedad: movimiento.novedad,
          orden_id: movimiento.orden_id,
          items: [],
        });
      }
      mapa.get(clave).items.push(movimiento);
    });
    return Array.from(mapa.values());
  }, [movimientos]);

  const ordenPorId = useMemo(
    () => new Map(ordenes.map((orden) => [orden.id, orden])),
    [ordenes],
  );

  const abrirActa = (lote) => {
    const orden = lote.orden_id ? ordenPorId.get(lote.orden_id) : null;
    const colaborador = colaboradores.find((c) => c.id === lote.colaborador_id) || null;
    const abierta = imprimirActaHerramientas({
      empresa,
      lote,
      orden,
      colaborador: colaborador || { nombre_completo: lote.colaborador_nombre },
      registradoPor: lote.registrado_por_nombre,
    });
    if (!abierta) {
      mostrar(
        'Ventana emergente bloqueada',
        'Permite las ventanas emergentes para abrir el acta de herramientas.',
        'advertencia',
      );
    }
  };

  const TABS = [
    { id: 'herramientas', etiqueta: 'Herramientas', Icono: Wrench },
    { id: 'kits', etiqueta: 'Kits por rol', Icono: Package },
    { id: 'checklists', etiqueta: 'Checklists', Icono: ClipboardCheck },
    { id: 'registros', etiqueta: 'Registros', Icono: ClipboardList },
    { id: 'movimientos', etiqueta: 'Movimientos', Icono: History },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Herramientas y Checklists</h1>
          <p className="text-xs text-slate-400 mt-1">
            Asignación por colaborador, control de salidas y entradas al taller, y registro de
            novedades.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedeAsignar && (
            <button
              type="button"
              onClick={abrirSalida}
              className="flex items-center gap-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-cyan-600/20"
            >
              <ArrowUpRight size={16} /> Salida de herramientas
            </button>
          )}
          {puedeAsignar && (
            <button
              type="button"
              onClick={abrirEntrada}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-700"
            >
              <ArrowDownLeft size={16} /> Registrar entrada
            </button>
          )}
          {puedeAsignar && (
            <button
              type="button"
              onClick={abrirNuevaHerramienta}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus size={16} /> Nueva herramienta
            </button>
          )}
          {puedeUsar && (
            <button
              type="button"
              onClick={() => abrirRegistro('salida')}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20"
            >
              <ClipboardCheck size={16} /> Registrar checklist
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { etiqueta: 'En catálogo', valor: resumen.total, color: 'text-blue-400' },
          { etiqueta: 'Disponibles', valor: resumen.disponibles, color: 'text-emerald-400' },
          { etiqueta: 'Asignadas', valor: resumen.asignadas, color: 'text-cyan-400' },
          { etiqueta: 'Con novedad', valor: resumen.novedades, color: 'text-amber-400' },
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

      <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-1.5 sm:w-fit">
        {TABS.map(({ id, etiqueta, Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${
              tab === id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icono size={14} /> {etiqueta}
          </button>
        ))}
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

      {tab === 'herramientas' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
              <input
                type="search"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por nombre, código, categoría o colaborador..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value)}
              aria-label="Filtrar herramientas por estado"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todos los estados</option>
              {ESTADOS_HERRAMIENTA.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Herramienta</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Asignada a</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cargando ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-slate-500">
                        Cargando herramientas...
                      </td>
                    </tr>
                  ) : filtradas.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-slate-500">
                        {herramientas.length === 0
                          ? 'No hay herramientas registradas.'
                          : 'Ninguna herramienta coincide con los filtros.'}
                      </td>
                    </tr>
                  ) : (
                    filtradas.map((herramienta) => (
                      <tr key={herramienta.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                              <HardHat size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{herramienta.nombre}</p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {herramienta.codigo || 'Sin código'}
                                {herramienta.descripcion ? ` · ${herramienta.descripcion}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">{herramienta.categoria}</td>
                        <td className="p-4">
                          <EstadoBadge estado={herramienta.estado} />
                        </td>
                        <td className="p-4 text-slate-300">
                          {herramienta.colaborador_nombre ? (
                            <>
                              <p className="inline-flex items-center gap-1 text-[11px]">
                                <User size={11} /> {herramienta.colaborador_nombre}
                              </p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {herramienta.asignado_por_nombre
                                  ? `Asignó: ${herramienta.asignado_por_nombre}`
                                  : ''}
                                {herramienta.asignado_en
                                  ? ` · ${formatFechaHora(herramienta.asignado_en)}`
                                  : ''}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-500">Sin asignar</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {puedeAsignar && herramienta.colaborador_id && (
                              <button
                                type="button"
                                onClick={() => devolverHerramienta(herramienta)}
                                title="Marcar como devuelta"
                                aria-label="Devolver herramienta"
                                className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-all"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            {puedeAsignar && (
                              <button
                                type="button"
                                onClick={() => abrirEditarHerramienta(herramienta)}
                                title="Editar o asignar"
                                aria-label="Editar herramienta"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            {puedeAsignar && (
                              <button
                                type="button"
                                onClick={() => eliminarHerramienta(herramienta)}
                                title="Eliminar del catálogo"
                                aria-label="Eliminar herramienta"
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'kits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] text-slate-400 max-w-2xl">
              Un kit es la lista de herramientas recomendadas para un área. Al registrar una
              salida, eliges el kit y se marcan de una vez las unidades disponibles cuyo nombre
              coincida.
            </p>
            {puedeAsignar && (
              <button
                type="button"
                onClick={abrirNuevoKit}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl text-xs shrink-0"
              >
                <Plus size={15} /> Nuevo kit
              </button>
            )}
          </div>

          {cargando ? (
            <p className="text-xs text-slate-500 py-6 text-center">Cargando kits...</p>
          ) : kits.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
              <Package className="mx-auto text-slate-600" size={26} />
              <p className="text-xs font-bold text-slate-300 mt-2">Todavía no hay kits</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Crea uno por área: producción, instalación o bodega.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kits.map((kit) => (
                <div
                  key={kit.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-white">{kit.nombre}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold border bg-blue-500/10 text-blue-400 border-blue-500/20">
                        {ETIQUETAS_ROL[kit.rol_destino] || kit.rol_destino}
                      </span>
                    </div>
                    {puedeAsignar && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirEditarKit(kit)}
                          aria-label="Editar kit"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarKit(kit)}
                          aria-label="Eliminar kit"
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {kit.descripcion && (
                    <p className="text-[10px] text-slate-500">{kit.descripcion}</p>
                  )}

                  <ul className="space-y-1.5">
                    {(kit.items || []).map((item, indice) => (
                      <li
                        key={indice}
                        className="flex items-start justify-between gap-2 text-[11px] text-slate-300"
                      >
                        <span className="flex items-start gap-2">
                          <Wrench size={12} className="text-slate-500 shrink-0 mt-0.5" />
                          {item?.nombre || String(item || '')}
                        </span>
                        {Number(item?.cantidad) > 1 && (
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded">
                            x{Number(item.cantidad)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'checklists' && (
        <div className="space-y-4">
          {puedeAsignar && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={abrirNuevoChecklist}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                <Plus size={15} /> Nueva plantilla
              </button>
            </div>
          )}

          {cargando ? (
            <p className="text-xs text-slate-500 py-6 text-center">Cargando checklists...</p>
          ) : plantillas.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
              <ClipboardCheck className="mx-auto text-slate-600" size={26} />
              <p className="text-xs font-bold text-slate-300 mt-2">Todavía no hay plantillas</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Crea los puntos de verificación de salida y entrada al taller.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plantillas.map((plantilla) => (
                <div
                  key={plantilla.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-white">{plantilla.nombre}</p>
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                          plantilla.tipo === 'salida'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {plantilla.tipo === 'salida' ? 'Salida del taller' : 'Entrada al taller'}
                      </span>
                    </div>
                    {puedeAsignar && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => abrirEditarChecklist(plantilla)}
                          aria-label="Editar checklist"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarChecklist(plantilla)}
                          aria-label="Eliminar checklist"
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {(plantilla.items || []).map((item, indice) => (
                      <li key={indice} className="flex items-start gap-2 text-[11px] text-slate-300">
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  {puedeUsar && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormRegistro({
                          ...FORM_REGISTRO,
                          tipo: plantilla.tipo,
                          plantillaId: plantilla.id,
                          colaboradorId:
                            permisos?.esProduccion || permisos?.esInstalador
                              ? perfil?.id || ''
                              : '',
                          marcados: [],
                        });
                        setErrorRegistro('');
                        setModalRegistro(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl text-[11px]"
                    >
                      <ClipboardCheck size={13} /> Firmar este checklist
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'registros' && (
        <div className="space-y-3">
          {cargando ? (
            <p className="text-xs text-slate-500 py-6 text-center">Cargando registros...</p>
          ) : registros.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
              <ClipboardList className="mx-auto text-slate-600" size={26} />
              <p className="text-xs font-bold text-slate-300 mt-2">Sin registros todavía</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Las salidas y entradas firmadas aparecerán aquí.
              </p>
            </div>
          ) : (
            registros.map((registro) => {
              const items = Array.isArray(registro.items) ? registro.items : [];
              const marcados = items.filter((item) => item.marcado).length;
              return (
                <div
                  key={registro.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white">
                        {registro.checklist_nombre || 'Checklist'}
                        <span
                          className={`ml-2 px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                            registro.tipo === 'salida'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {registro.tipo === 'salida' ? 'Salida' : 'Entrada'}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {registro.colaborador_nombre || 'Colaborador'} ·{' '}
                        {formatFechaHora(registro.creado_en)}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg">
                      {marcados}/{items.length} verificados
                    </span>
                  </div>

                  {items.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {items.map((item, indice) => (
                        <span
                          key={indice}
                          className={`flex items-start gap-1.5 text-[10px] ${
                            item.marcado ? 'text-emerald-300' : 'text-slate-500 line-through'
                          }`}
                        >
                          {item.marcado ? (
                            <CheckCircle2 size={11} className="shrink-0 mt-0.5" />
                          ) : (
                            <X size={11} className="shrink-0 mt-0.5" />
                          )}
                          {item.texto}
                        </span>
                      ))}
                    </div>
                  )}

                  {Array.isArray(registro.herramientas) && registro.herramientas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {registro.herramientas.map((herramienta, indice) => (
                        <span
                          key={`${herramienta?.id || 'h'}-${indice}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300"
                        >
                          <Wrench size={10} className="text-slate-500" />
                          {herramienta?.nombre || 'Herramienta'}
                          {herramienta?.codigo ? (
                            <span className="text-slate-500 font-mono">({herramienta.codigo})</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  )}

                  {registro.novedad && (
                    <p className="text-[10px] text-amber-200 bg-amber-950/40 border border-amber-500/20 rounded-lg px-3 py-2">
                      <strong>Novedad:</strong> {registro.novedad}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'movimientos' && (
        <div className="space-y-3">
          {cargando ? (
            <p className="text-xs text-slate-500 py-6 text-center">Cargando movimientos...</p>
          ) : lotes.length === 0 ? (
            <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
              <History className="mx-auto text-slate-600" size={26} />
              <p className="text-xs font-bold text-slate-300 mt-2">Sin movimientos todavía</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Cada salida y entrada de herramientas quedará registrada aquí.
              </p>
            </div>
          ) : (
            lotes.map((lote) => {
              const orden = lote.orden_id ? ordenPorId.get(lote.orden_id) : null;
              const esSalida = lote.tipo === 'salida';
              return (
                <div
                  key={lote.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                            esSalida
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {esSalida ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                          {esSalida ? 'Salida' : 'Entrada'}
                        </span>
                        {lote.colaborador_nombre || 'Colaborador'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatFechaHora(lote.creado_en)}
                        {lote.registrado_por_nombre
                          ? ` · Registró: ${lote.registrado_por_nombre}`
                          : ''}
                        {orden ? ` · Orden ${orden.codigo_orden || ''} ${orden.cliente_nombre || ''}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-300 bg-slate-950 border border-slate-800 px-2 py-1 rounded-lg">
                        {lote.items.length} herramienta(s)
                      </span>
                      <button
                        type="button"
                        onClick={() => abrirActa(lote)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        <Printer size={12} />
                        {esSalida ? 'Carta responsiva' : 'Acta de devolución'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {lote.items.map((movimiento) => (
                      <span
                        key={movimiento.id}
                        className="flex items-start gap-1.5 text-[10px] text-slate-300"
                      >
                        <Wrench size={11} className="shrink-0 mt-0.5 text-slate-500" />
                        {movimiento.herramienta_nombre}
                        {movimiento.herramienta_codigo ? (
                          <span className="text-slate-500 font-mono">
                            ({movimiento.herramienta_codigo})
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>

                  {lote.novedad && (
                    <p className="text-[10px] text-amber-200 bg-amber-950/40 border border-amber-500/20 rounded-lg px-3 py-2">
                      <strong>Novedad:</strong> {lote.novedad}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal herramienta */}
      <Modal
        abierto={modalHerramienta}
        onClose={() => setModalHerramienta(false)}
        icono={<Wrench size={20} />}
        titulo={herramientaEditando ? 'Editar herramienta' : 'Nueva herramienta'}
        subtitulo="Registra la herramienta y asígnala a un colaborador de producción o instalación."
        ancho="max-w-lg"
      >
        <form onSubmit={guardarHerramienta} className="space-y-4">
          {errorHerramienta && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorHerramienta}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="herramienta-nombre" className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                id="herramienta-nombre"
                type="text"
                value={formHerramienta.nombre}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, nombre: evento.target.value }))
                }
                placeholder="Ej. Taladro percutor Bosch"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="herramienta-codigo" className="block text-xs font-semibold text-slate-300 mb-1">
                Código / serial
              </label>
              <input
                id="herramienta-codigo"
                type="text"
                value={formHerramienta.codigo}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, codigo: evento.target.value }))
                }
                placeholder="Ej. TAL-001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="herramienta-categoria" className="block text-xs font-semibold text-slate-300 mb-1">
                Categoría
              </label>
              <select
                id="herramienta-categoria"
                value={formHerramienta.categoria}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, categoria: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {CATEGORIAS_HERRAMIENTA.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="herramienta-estado" className="block text-xs font-semibold text-slate-300 mb-1">
                Estado
              </label>
              <select
                id="herramienta-estado"
                value={formHerramienta.estado}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, estado: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {ESTADOS_HERRAMIENTA.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="herramienta-colaborador"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Asignar a
              </label>
              <select
                id="herramienta-colaborador"
                value={formHerramienta.colaboradorId}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, colaboradorId: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Sin asignar (disponible)</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre_completo} · {colaborador.rol}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="herramienta-descripcion"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Descripción
              </label>
              <input
                id="herramienta-descripcion"
                type="text"
                value={formHerramienta.descripcion}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, descripcion: evento.target.value }))
                }
                placeholder="Marca, modelo, accesorios..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="herramienta-notas" className="block text-xs font-semibold text-slate-300 mb-1">
                Notas de asignación
              </label>
              <textarea
                id="herramienta-notas"
                rows="2"
                value={formHerramienta.notas}
                onChange={(evento) =>
                  setFormHerramienta((prev) => ({ ...prev, notas: evento.target.value }))
                }
                placeholder="Ej. Se entrega con dos baterías y maletín."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalHerramienta(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar herramienta'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal checklist */}
      <Modal
        abierto={modalChecklist}
        onClose={() => setModalChecklist(false)}
        icono={<ClipboardCheck size={20} />}
        titulo={checklistEditando ? 'Editar checklist' : 'Nueva plantilla de checklist'}
        subtitulo="Un punto de verificación por línea."
      >
        <form onSubmit={guardarChecklist} className="space-y-4">
          <div>
            <label htmlFor="checklist-nombre" className="block text-xs font-semibold text-slate-300 mb-1">
              Nombre
            </label>
            <input
              id="checklist-nombre"
              type="text"
              value={formChecklist.nombre}
              onChange={(evento) =>
                setFormChecklist((prev) => ({ ...prev, nombre: evento.target.value }))
              }
              placeholder="Ej. Salida a instalación"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="checklist-tipo" className="block text-xs font-semibold text-slate-300 mb-1">
              Momento
            </label>
            <select
              id="checklist-tipo"
              value={formChecklist.tipo}
              onChange={(evento) =>
                setFormChecklist((prev) => ({ ...prev, tipo: evento.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="salida">Salida del taller</option>
              <option value="entrada">Entrada al taller</option>
            </select>
          </div>

          <div>
            <label htmlFor="checklist-items" className="block text-xs font-semibold text-slate-300 mb-1">
              Puntos de verificación
            </label>
            <textarea
              id="checklist-items"
              rows="7"
              value={formChecklist.items}
              onChange={(evento) =>
                setFormChecklist((prev) => ({ ...prev, items: evento.target.value }))
              }
              placeholder={'Taladro y baterías cargadas\nNivel y cinta métrica\nHerramientas de mano completas'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalChecklist(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar checklist'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal registro de checklist */}
      <Modal
        abierto={modalRegistro}
        onClose={() => setModalRegistro(false)}
        icono={<ClipboardCheck size={20} />}
        titulo="Firmar checklist"
        subtitulo="Marca cada punto verificado y reporta cualquier novedad."
        ancho="max-w-lg"
      >
        <form onSubmit={guardarRegistro} className="space-y-4">
          {errorRegistro && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorRegistro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="registro-tipo" className="block text-xs font-semibold text-slate-300 mb-1">
                Momento
              </label>
              <select
                id="registro-tipo"
                value={formRegistro.tipo}
                onChange={(evento) => cambiarTipoRegistro(evento.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="salida">Salida del taller</option>
                <option value="entrada">Entrada al taller</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="registro-colaborador"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Colaborador
              </label>
              <select
                id="registro-colaborador"
                value={formRegistro.colaboradorId}
                onChange={(evento) =>
                  setFormRegistro((prev) => ({ ...prev, colaboradorId: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                disabled={permisos?.esProduccion || permisos?.esInstalador}
              >
                <option value="">Selecciona...</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre_completo} · {colaborador.rol}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="registro-plantilla"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Plantilla
              </label>
              <select
                id="registro-plantilla"
                value={formRegistro.plantillaId}
                onChange={(evento) =>
                  setFormRegistro((prev) => ({
                    ...prev,
                    plantillaId: evento.target.value,
                    marcados: [],
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecciona una plantilla...</option>
                {plantillas
                  .filter((plantilla) => plantilla.tipo === formRegistro.tipo)
                  .map((plantilla) => (
                    <option key={plantilla.id} value={plantilla.id}>
                      {plantilla.nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {plantillaRegistro && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
              {(plantillaRegistro.items || []).map((item, indice) => {
                const marcado = formRegistro.marcados.includes(indice);
                return (
                  <label
                    key={indice}
                    className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setFormRegistro((prev) => ({
                          ...prev,
                          marcados: marcado
                            ? prev.marcados.filter((valor) => valor !== indice)
                            : [...prev.marcados, indice],
                        }))
                      }
                      className="mt-0.5 accent-emerald-500"
                    />
                    <span className={marcado ? 'text-emerald-300' : ''}>{item}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <label
              htmlFor="registro-novedad"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Novedades (opcional)
            </label>
            <textarea
              id="registro-novedad"
              rows="3"
              value={formRegistro.novedad}
              onChange={(evento) =>
                setFormRegistro((prev) => ({ ...prev, novedad: evento.target.value }))
              }
              placeholder="Ej. Faltó una broca, se reportó al jefe. Se devolvió todo completo."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalRegistro(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Firmar checklist'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal salida de herramientas */}
      <Modal
        abierto={modalSalida}
        onClose={() => setModalSalida(false)}
        icono={<ArrowUpRight size={20} />}
        titulo="Registrar salida de herramientas"
        subtitulo="Marca de la lista las herramientas que se lleva el colaborador."
        ancho="max-w-xl"
      >
        <form onSubmit={guardarSalida} className="space-y-4">
          {errorSalida && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorSalida}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="salida-colaborador"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Colaborador <span className="text-red-400">*</span>
              </label>
              <select
                id="salida-colaborador"
                value={formSalida.colaboradorId}
                onChange={(evento) =>
                  setFormSalida((prev) => ({
                    ...prev,
                    colaboradorId: evento.target.value,
                    kitId: '',
                  }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">Selecciona...</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre_completo} · {colaborador.rol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="salida-orden"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Orden (opcional)
              </label>
              <select
                id="salida-orden"
                value={formSalida.ordenId}
                onChange={(evento) =>
                  setFormSalida((prev) => ({ ...prev, ordenId: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Sin orden asociada</option>
                {ordenes.map((orden) => (
                  <option key={orden.id} value={orden.id}>
                    {orden.codigo_orden || 'Orden'} · {orden.cliente_nombre || 'Cliente'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="salida-kit"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Kit por rol (opcional)
            </label>
            <select
              id="salida-kit"
              value={formSalida.kitId}
              onChange={(evento) => {
                const valor = evento.target.value;
                if (valor) {
                  aplicarKit(valor);
                } else {
                  setFormSalida((prev) => ({ ...prev, kitId: '' }));
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Selección manual</option>
              {kitsSalida.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.nombre} · {ETIQUETAS_ROL[kit.rol_destino] || kit.rol_destino}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Al elegir un kit se marcan solas las herramientas disponibles que coincidan.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Herramientas disponibles <span className="text-red-400">*</span>
              </label>
              {disponiblesSalida.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFormSalida((prev) => ({
                      ...prev,
                      herramientaIds:
                        prev.herramientaIds.length === disponiblesSalida.length
                          ? []
                          : disponiblesSalida.map((h) => h.id),
                    }))
                  }
                  className="text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  {formSalida.herramientaIds.length === disponiblesSalida.length
                    ? 'Limpiar'
                    : 'Marcar todas'}
                </button>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl divide-y divide-slate-800/70">
              {disponiblesSalida.length === 0 ? (
                <p className="p-4 text-[11px] text-slate-500 text-center">
                  No hay herramientas disponibles. Devuelve alguna o registra una nueva.
                </p>
              ) : (
                disponiblesSalida.map((herramienta) => {
                  const marcada = formSalida.herramientaIds.includes(herramienta.id);
                  return (
                    <label
                      key={herramienta.id}
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer hover:bg-slate-900/60"
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() =>
                          setFormSalida((prev) => ({
                            ...prev,
                            herramientaIds: marcada
                              ? prev.herramientaIds.filter((id) => id !== herramienta.id)
                              : [...prev.herramientaIds, herramienta.id],
                          }))
                        }
                        className="mt-0.5 accent-cyan-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold text-white truncate">
                          {herramienta.nombre}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {herramienta.codigo || 'Sin código'} · {herramienta.categoria}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {formSalida.herramientaIds.length} seleccionada(s)
            </p>
          </div>

          <div>
            <label
              htmlFor="salida-plantilla"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Checklist de salida (opcional)
            </label>
            <select
              id="salida-plantilla"
              value={formSalida.plantillaId}
              onChange={(evento) =>
                setFormSalida((prev) => ({
                  ...prev,
                  plantillaId: evento.target.value,
                  marcados: [],
                }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Sin checklist</option>
              {plantillas
                .filter((plantilla) => plantilla.tipo === 'salida')
                .map((plantilla) => (
                  <option key={plantilla.id} value={plantilla.id}>
                    {plantilla.nombre}
                  </option>
                ))}
            </select>
          </div>

          {plantillaSalida && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
              {(plantillaSalida.items || []).map((item, indice) => {
                const marcado = formSalida.marcados.includes(indice);
                return (
                  <label
                    key={indice}
                    className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setFormSalida((prev) => ({
                          ...prev,
                          marcados: marcado
                            ? prev.marcados.filter((valor) => valor !== indice)
                            : [...prev.marcados, indice],
                        }))
                      }
                      className="mt-0.5 accent-emerald-500"
                    />
                    <span className={marcado ? 'text-emerald-300' : ''}>{item}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <label
              htmlFor="salida-novedad"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Novedad (opcional)
            </label>
            <textarea
              id="salida-novedad"
              rows="2"
              value={formSalida.novedad}
              onChange={(evento) =>
                setFormSalida((prev) => ({ ...prev, novedad: evento.target.value }))
              }
              placeholder="Ej. Se entrega sin maletín, se reportó al jefe."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalSalida(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Registrar salida'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal entrada de herramientas */}
      <Modal
        abierto={modalEntrada}
        onClose={() => setModalEntrada(false)}
        icono={<ArrowDownLeft size={20} />}
        titulo="Registrar entrada de herramientas"
        subtitulo="Devuelve al taller las herramientas que tiene un colaborador."
        ancho="max-w-xl"
      >
        <form onSubmit={guardarEntrada} className="space-y-4">
          {errorEntrada && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorEntrada}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="entrada-colaborador"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Colaborador <span className="text-red-400">*</span>
            </label>
            <select
              id="entrada-colaborador"
              value={formEntrada.colaboradorId}
              onChange={(evento) =>
                setFormEntrada((prev) => ({
                  ...prev,
                  colaboradorId: evento.target.value,
                  herramientaIds: [],
                }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Selecciona...</option>
              {colaboradores.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nombre_completo} · {colaborador.rol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Herramientas asignadas <span className="text-red-400">*</span>
              </label>
              {asignadasEntrada.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setFormEntrada((prev) => ({
                      ...prev,
                      herramientaIds:
                        prev.herramientaIds.length === asignadasEntrada.length
                          ? []
                          : asignadasEntrada.map((h) => h.id),
                    }))
                  }
                  className="text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  {formEntrada.herramientaIds.length === asignadasEntrada.length
                    ? 'Limpiar'
                    : 'Marcar todas'}
                </button>
              )}
            </div>
            <div className="max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl divide-y divide-slate-800/70">
              {!formEntrada.colaboradorId ? (
                <p className="p-4 text-[11px] text-slate-500 text-center">
                  Selecciona primero el colaborador.
                </p>
              ) : asignadasEntrada.length === 0 ? (
                <p className="p-4 text-[11px] text-slate-500 text-center">
                  Este colaborador no tiene herramientas asignadas.
                </p>
              ) : (
                asignadasEntrada.map((herramienta) => {
                  const marcada = formEntrada.herramientaIds.includes(herramienta.id);
                  return (
                    <label
                      key={herramienta.id}
                      className="flex items-start gap-2.5 p-2.5 cursor-pointer hover:bg-slate-900/60"
                    >
                      <input
                        type="checkbox"
                        checked={marcada}
                        onChange={() =>
                          setFormEntrada((prev) => ({
                            ...prev,
                            herramientaIds: marcada
                              ? prev.herramientaIds.filter((id) => id !== herramienta.id)
                              : [...prev.herramientaIds, herramienta.id],
                          }))
                        }
                        className="mt-0.5 accent-emerald-500"
                      />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold text-white truncate">
                          {herramienta.nombre}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {herramienta.codigo || 'Sin código'} · {herramienta.categoria}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {formEntrada.herramientaIds.length} seleccionada(s)
            </p>
          </div>

          <div>
            <label
              htmlFor="entrada-plantilla"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Checklist de entrada (opcional)
            </label>
            <select
              id="entrada-plantilla"
              value={formEntrada.plantillaId}
              onChange={(evento) =>
                setFormEntrada((prev) => ({
                  ...prev,
                  plantillaId: evento.target.value,
                  marcados: [],
                }))
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Sin checklist</option>
              {plantillas
                .filter((plantilla) => plantilla.tipo === 'entrada')
                .map((plantilla) => (
                  <option key={plantilla.id} value={plantilla.id}>
                    {plantilla.nombre}
                  </option>
                ))}
            </select>
          </div>

          {plantillaEntrada && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
              {(plantillaEntrada.items || []).map((item, indice) => {
                const marcado = formEntrada.marcados.includes(indice);
                return (
                  <label
                    key={indice}
                    className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() =>
                        setFormEntrada((prev) => ({
                          ...prev,
                          marcados: marcado
                            ? prev.marcados.filter((valor) => valor !== indice)
                            : [...prev.marcados, indice],
                        }))
                      }
                      className="mt-0.5 accent-emerald-500"
                    />
                    <span className={marcado ? 'text-emerald-300' : ''}>{item}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div>
            <label
              htmlFor="entrada-novedad"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Novedad (opcional)
            </label>
            <textarea
              id="entrada-novedad"
              rows="2"
              value={formEntrada.novedad}
              onChange={(evento) =>
                setFormEntrada((prev) => ({ ...prev, novedad: evento.target.value }))
              }
              placeholder="Ej. Se devuelve completa; falta una broca."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalEntrada(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Registrar entrada'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal kit por rol */}
      <Modal
        abierto={modalKit}
        onClose={() => setModalKit(false)}
        icono={<Package size={20} />}
        titulo={kitEditando ? 'Editar kit por rol' : 'Nuevo kit por rol'}
        subtitulo="Herramientas recomendadas para un área, una por línea."
        ancho="max-w-lg"
      >
        <form onSubmit={guardarKit} className="space-y-4">
          {errorKit && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorKit}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="kit-nombre"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                id="kit-nombre"
                type="text"
                value={formKit.nombre}
                onChange={(evento) =>
                  setFormKit((prev) => ({ ...prev, nombre: evento.target.value }))
                }
                placeholder="Ej. Kit de instalación"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label
                htmlFor="kit-rol"
                className="block text-xs font-semibold text-slate-300 mb-1"
              >
                Área / rol
              </label>
              <select
                id="kit-rol"
                value={formKit.rolDestino}
                onChange={(evento) =>
                  setFormKit((prev) => ({ ...prev, rolDestino: evento.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="produccion">Producción</option>
                <option value="instalador">Instalación</option>
                <option value="bodega">Bodega</option>
                <option value="otro">General</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="kit-descripcion"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Descripción
            </label>
            <input
              id="kit-descripcion"
              type="text"
              value={formKit.descripcion}
              onChange={(evento) =>
                setFormKit((prev) => ({ ...prev, descripcion: evento.target.value }))
              }
              placeholder="Para qué tipo de trabajo se usa"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="kit-items"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Herramientas <span className="text-red-400">*</span>
            </label>
            <textarea
              id="kit-items"
              rows="6"
              value={formKit.items}
              onChange={(evento) =>
                setFormKit((prev) => ({ ...prev, items: evento.target.value }))
              }
              placeholder={'Taladro\nNivel láser\nCinta métrica | 2\nArnés'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Una por línea. Usa <span className="font-mono">| cantidad</span> si necesitas más
              de una, por ejemplo <span className="font-mono">Cinta métrica | 2</span>. El nombre
              se compara con el catálogo; “Taladro” encuentra “Taladro percutor Bosch”.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalKit(false)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-colors"
            >
              {guardando ? 'Guardando...' : 'Guardar kit'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
