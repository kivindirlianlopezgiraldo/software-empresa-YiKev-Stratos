import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Edit2,
  Eye,
  HeartPulse,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Search,
  Shirt,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  DEPARTAMENTOS,
  ROLES,
  ROLES_LIST,
  TALLAS,
  TALLAS_CALZADO,
  TIPOS_CONTRATO,
} from '../lib/constants';
import { crearUsuarioAuth } from '../lib/auth';
import { formatCOP, formatFecha, formatMiles, parseCOP, soloDigitos } from '../lib/format';

import Toast from '../components/Toast';
import Modal from '../components/Modal';
import useToast from '../hooks/useToast';
import useConfirm from '../hooks/useConfirm';

const claseInput =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50';

const FORM_VACIO = {
  nombreCompleto: '',
  documento: '',
  password: '',
  telefono: '',
  emailPersonal: '',
  fechaNacimiento: '',
  direccion: '',
  ciudad: '',
  rol: ROLES.INSTALADOR,
  departamento: DEPARTAMENTOS[0],
  tipoContrato: '',
  fechaIngreso: '',
  salario: '',
  activo: true,
  eps: '',
  arl: '',
  contactoEmergenciaNombre: '',
  contactoEmergenciaTelefono: '',
  tallaCamisa: '',
  tallaPantalon: '',
  tallaCalzado: '',
  notas: '',
};

const MENSAJE_MIGRACION =
  ' Falta aplicar la migración 003_admin_empresa.sql en Supabase para guardar los datos ampliados.';

function conAyudaMigracion(mensaje) {
  return /column|schema cache|does not exist|no existe/i.test(mensaje)
    ? `${mensaje}${MENSAJE_MIGRACION}`
    : mensaje;
}

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

function Seccion({ icono, titulo, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <span className="text-blue-500 shrink-0">{icono}</span>
        <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">{titulo}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Dato({ etiqueta, valor, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{etiqueta}</p>
      <p className={`text-xs text-slate-200 mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>
        {valor || '—'}
      </p>
    </div>
  );
}

function desdeFila(colaborador) {
  return {
    nombreCompleto: colaborador.nombre_completo || '',
    documento: colaborador.documento_id || '',
    password: '',
    telefono: colaborador.telefono || '',
    emailPersonal: colaborador.email_personal || '',
    fechaNacimiento: colaborador.fecha_nacimiento || '',
    direccion: colaborador.direccion || '',
    ciudad: colaborador.ciudad || '',
    rol: colaborador.rol || ROLES.INSTALADOR,
    departamento: colaborador.departamento || DEPARTAMENTOS[0],
    tipoContrato: colaborador.tipo_contrato || '',
    fechaIngreso: colaborador.fecha_ingreso || '',
    salario: colaborador.salario ? formatMiles(colaborador.salario) : '',
    activo: colaborador.activo !== false,
    eps: colaborador.eps || '',
    arl: colaborador.arl || '',
    contactoEmergenciaNombre: colaborador.contacto_emergencia_nombre || '',
    contactoEmergenciaTelefono: colaborador.contacto_emergencia_telefono || '',
    tallaCamisa: colaborador.talla_camisa || '',
    tallaPantalon: colaborador.talla_pantalon || '',
    tallaCalzado: colaborador.talla_calzado || '',
    notas: colaborador.notas || '',
  };
}

export default function Colaboradores({ perfil }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroDepartamento, setFiltroDepartamento] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');
  const [colaboradorContrasena, setColaboradorContrasena] = useState(null);
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  const [restableciendoContrasena, setRestableciendoContrasena] = useState(false);
  const [errorContrasena, setErrorContrasena] = useState('');

  const { alerta, mostrar, cerrar } = useToast();
  const confirmar = useConfirm();

  const consultarColaboradores = useCallback(async () => {
    const { data, error: errorConsulta } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .order('nombre_completo', { ascending: true });

    if (errorConsulta) throw errorConsulta;
    return data ?? [];
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        const filas = await consultarColaboradores();
        if (!activo) return;
        setColaboradores(filas);
        setError('');
      } catch (err) {
        if (activo) setError(err.message || 'No se pudo cargar la lista de colaboradores.');
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarColaboradores, recarga]);

  const reintentar = () => {
    setCargando(true);
    setRecarga((valor) => valor + 1);
  };

  const refrescar = useCallback(() => setRecarga((valor) => valor + 1), []);

  const cerrarRestablecimiento = () => {
    if (restableciendoContrasena) return;
    setColaboradorContrasena(null);
    setNuevaContrasena('');
    setConfirmarContrasena('');
    setErrorContrasena('');
  };

  const restablecerContrasena = async (evento) => {
    evento.preventDefault();
    if (!colaboradorContrasena || perfil?.rol !== ROLES.SUPER_ADMIN) return;

    if (nuevaContrasena.length < 8) {
      setErrorContrasena('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      setErrorContrasena('Las contraseñas no coinciden.');
      return;
    }

    setRestableciendoContrasena(true);
    setErrorContrasena('');
    try {
      const { data, error: errorFuncion } = await supabase.functions.invoke(
        'restablecer-contrasena',
        {
          body: {
            userId: colaboradorContrasena.id,
            newPassword: nuevaContrasena,
          },
        },
      );

      if (errorFuncion) {
        let detalle = data?.error;
        if (!detalle && errorFuncion.context instanceof Response) {
          try {
            const respuestaError = await errorFuncion.context.clone().json();
            detalle = respuestaError?.error;
          } catch {
            detalle = '';
          }
        }
        throw new Error(detalle || 'No se pudo restablecer la contraseña.');
      }
      if (!data?.ok) {
        throw new Error(data?.error || 'No se pudo confirmar el restablecimiento.');
      }

      mostrar(
        'Contraseña restablecida',
        `La contraseña de ${colaboradorContrasena.nombre_completo} fue actualizada. Comunícale la nueva contraseña por un canal seguro.`,
        'exito',
      );
      setColaboradorContrasena(null);
      setNuevaContrasena('');
      setConfirmarContrasena('');
    } catch (err) {
      setErrorContrasena(err.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setRestableciendoContrasena(false);
    }
  };

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (errorForm) setErrorForm('');
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrorForm('');
    setModalAbierto(true);
  };

  const abrirEditar = (colaborador) => {
    setFicha(null);
    setEditando(colaborador);
    setForm(desdeFila(colaborador));
    setErrorForm('');
    setModalAbierto(true);
  };

  const handleGuardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setErrorForm('');

    try {
      const nombre = form.nombreCompleto.trim();
      const documento = soloDigitos(form.documento);
      const salario = parseCOP(form.salario);
      const emailPersonal = form.emailPersonal.trim();

      if (!nombre) throw new Error('El nombre completo es obligatorio.');
      if (!documento) throw new Error('El número de documento es obligatorio.');
      if (!editando && form.password.trim().length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      if (emailPersonal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPersonal)) {
        throw new Error('El correo personal no es válido.');
      }

      if (editando && editando.id === perfil?.id) {
        if (form.rol !== editando.rol) {
          throw new Error(
            'No puedes cambiar tu propio rol. Pide a otro administrador que lo haga.',
          );
        }
        if (form.activo === false) {
          throw new Error('No puedes desactivar tu propia cuenta de administrador.');
        }
      }

      const datos = {
        nombre_completo: nombre,
        telefono: form.telefono.trim(),
        email_personal: emailPersonal,
        fecha_nacimiento: form.fechaNacimiento || null,
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        departamento: form.departamento,
        tipo_contrato: form.tipoContrato || null,
        fecha_ingreso: form.fechaIngreso || null,
        salario,
        rol: form.rol,
        activo: form.activo,
        eps: form.eps.trim(),
        arl: form.arl.trim(),
        contacto_emergencia_nombre: form.contactoEmergenciaNombre.trim(),
        contacto_emergencia_telefono: form.contactoEmergenciaTelefono.trim(),
        talla_camisa: form.tallaCamisa,
        talla_pantalon: form.tallaPantalon,
        talla_calzado: form.tallaCalzado,
        notas: form.notas.trim(),
      };

      if (editando) {
        const { error: errorUpdate } = await supabase
          .from('perfiles_usuario')
          .update(datos)
          .eq('id', editando.id);

        if (errorUpdate) throw errorUpdate;
        mostrar('¡Actualizado!', 'Los datos del colaborador fueron modificados.', 'exito');
      } else {
        // 1) Crear la cuenta en Supabase Auth (email interno derivado del documento)
        const usuario = await crearUsuarioAuth(documento, form.password.trim());

        // Supabase devuelve un usuario "falso" con identities vacías si ya existía
        if (Array.isArray(usuario.identities) && usuario.identities.length === 0) {
          throw new Error('Ese número de documento ya tiene una cuenta registrada.');
        }

        // 2) Crear el perfil enlazado por id
        const { error: errorPerfil } = await supabase.from('perfiles_usuario').insert([
          {
            id: usuario.id,
            documento_id: documento,
            ...datos,
          },
        ]);

        if (errorPerfil) {
          throw new Error(
            `La cuenta de acceso se creó, pero el perfil falló: ${errorPerfil.message}. ` +
              'Revisa la política RLS de perfiles_usuario.',
          );
        }

        mostrar('¡Colaborador Registrado!', 'Ya puede iniciar sesión con su documento.', 'exito');
      }

      setModalAbierto(false);
      refrescar();
    } catch (err) {
      setErrorForm(conAyudaMigracion(err.message || 'Error al procesar la solicitud.'));
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (colaborador) => {
    if (colaborador.id === perfil?.id) {
      mostrar(
        'Acción no permitida',
        'No puedes desactivar tu propia cuenta. Pide a otro administrador que lo haga.',
      );
      return;
    }

    const nuevoEstado = colaborador.activo === false;
    const { error: errorUpdate } = await supabase
      .from('perfiles_usuario')
      .update({ activo: nuevoEstado })
      .eq('id', colaborador.id);

    if (errorUpdate) {
      mostrar('No se pudo cambiar el estado', errorUpdate.message);
      return;
    }

    mostrar(
      nuevoEstado ? 'Colaborador activado' : 'Colaborador desactivado',
      nuevoEstado
        ? `${colaborador.nombre_completo} vuelve a estar activo en el sistema.`
        : `${colaborador.nombre_completo} queda inactivo, sin acceso operativo.`,
      'exito',
    );
    setFicha(null);
    refrescar();
  };

  const eliminarColaborador = async (colaborador) => {
    if (colaborador.id === perfil?.id) {
      mostrar('Acción no permitida', 'No puedes eliminar tu propio perfil de administrador.');
      return;
    }

    const confirmado = await confirmar({
      titulo: 'Eliminar acceso del colaborador',
      mensaje:
        `¿Eliminar el acceso de "${colaborador.nombre_completo}"?\n\n` +
        'Se borrará su perfil y dejará de ver datos del sistema. ' +
        'La cuenta de autenticación debe eliminarse desde el panel de Supabase.',
      confirmarTexto: 'Eliminar acceso',
    });
    if (!confirmado) return;

    try {
      const { error: errorDelete } = await supabase
        .from('perfiles_usuario')
        .delete()
        .eq('id', colaborador.id);

      if (errorDelete) throw errorDelete;
      mostrar('Perfil Eliminado', `Se eliminó el perfil de ${colaborador.nombre_completo}.`, 'exito');
      refrescar();
    } catch (err) {
      mostrar('Error al eliminar', err.message);
    }
  };

  const resumen = useMemo(() => {
    const activos = colaboradores.filter((colaborador) => colaborador.activo !== false);
    const nomina = activos.reduce((total, colaborador) => total + Number(colaborador.salario || 0), 0);
    return {
      total: colaboradores.length,
      activos: activos.length,
      inactivos: colaboradores.length - activos.length,
      nomina,
    };
  }, [colaboradores]);

  const filtrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    return colaboradores.filter((colaborador) => {
      const coincideTexto =
        !texto ||
        [
          colaborador.nombre_completo,
          colaborador.documento_id,
          colaborador.rol,
          colaborador.departamento,
          colaborador.telefono,
          colaborador.email_personal,
        ]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(texto));

      const coincideDepartamento =
        filtroDepartamento === 'todos' || colaborador.departamento === filtroDepartamento;

      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activos' && colaborador.activo !== false) ||
        (filtroEstado === 'inactivos' && colaborador.activo === false);

      return coincideTexto && coincideDepartamento && coincideEstado;
    });
  }, [colaboradores, busqueda, filtroDepartamento, filtroEstado]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <Toast alerta={alerta} onClose={cerrar} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Gestión de Empleados</h1>
          <p className="text-xs text-slate-400 mt-1">
            Administra el personal del taller: datos personales, contrato, seguridad social,
            dotación y accesos por rol.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={16} /> Registrar Nuevo Empleado
        </button>
      </div>

      {/* Resumen del personal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total</p>
            <p className="text-lg font-black text-white">{cargando ? '…' : resumen.total}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Power size={18} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Activos / Inactivos
            </p>
            <p className="text-lg font-black text-white">
              {cargando ? '…' : `${resumen.activos} / ${resumen.inactivos}`}
            </p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Wallet size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Nómina mensual (activos)
            </p>
            <p className="text-lg font-black text-white font-mono truncate">
              {cargando ? '…' : formatCOP(resumen.nomina)}
            </p>
          </div>
        </div>
      </div>

      {/* Búsqueda y filtros */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por nombre, documento, rol, área, teléfono o correo..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filtroDepartamento}
            onChange={(evento) => setFiltroDepartamento(evento.target.value)}
            aria-label="Filtrar por departamento"
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos los departamentos</option>
            {DEPARTAMENTOS.map((departamento) => (
              <option key={departamento} value={departamento}>
                {departamento}
              </option>
            ))}
          </select>

          <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-1">
            {[
              ['todos', 'Todos'],
              ['activos', 'Activos'],
              ['inactivos', 'Inactivos'],
            ].map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltroEstado(valor)}
                aria-pressed={filtroEstado === valor}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  filtroEstado === valor
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
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
                <th className="p-4">Empleado / Documento</th>
                <th className="p-4">Cargo y área</th>
                <th className="p-4">Contrato</th>
                <th className="p-4">Ingreso</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Salario</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cargando ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Cargando colaboradores...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    {colaboradores.length === 0
                      ? 'No hay colaboradores registrados.'
                      : 'Ningún colaborador coincide con los filtros.'}
                  </td>
                </tr>
              ) : (
                filtrados.map((colaborador) => {
                  const activo = colaborador.activo !== false;
                  return (
                    <tr
                      key={colaborador.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        activo ? '' : 'opacity-60'
                      }`}
                    >
                      <td className="p-4 font-bold text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                            <Users size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate">{colaborador.nombre_completo}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              C.C. {colaborador.documento_id || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 whitespace-nowrap">
                          {colaborador.rol || 'Sin rol'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {colaborador.departamento || 'General'}
                        </p>
                      </td>
                      <td className="p-4 text-slate-300 whitespace-nowrap">
                        {colaborador.tipo_contrato || '—'}
                      </td>
                      <td className="p-4 text-slate-300 whitespace-nowrap">
                        {formatFecha(colaborador.fecha_ingreso)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold border whitespace-nowrap ${
                            activo
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              activo ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-emerald-400 font-bold whitespace-nowrap">
                        {formatCOP(colaborador.salario)}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFicha(colaborador)}
                            title="Ver ficha completa"
                            aria-label={`Ver ficha de ${colaborador.nombre_completo}`}
                            className="p-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-300 rounded-lg transition-all"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => abrirEditar(colaborador)}
                            title="Editar colaborador"
                            aria-label={`Editar a ${colaborador.nombre_completo}`}
                            className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          {perfil?.rol === ROLES.SUPER_ADMIN && (
                            <button
                              type="button"
                              onClick={() => {
                                setColaboradorContrasena(colaborador);
                                setNuevaContrasena('');
                                setConfirmarContrasena('');
                                setErrorContrasena('');
                              }}
                              title="Restablecer contraseña"
                              aria-label={`Restablecer contraseña de ${colaborador.nombre_completo}`}
                              className="rounded-lg bg-amber-500/10 p-1.5 text-amber-300 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              <KeyRound size={14} aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => alternarActivo(colaborador)}
                            title={activo ? 'Desactivar colaborador' : 'Activar colaborador'}
                            aria-label={`${activo ? 'Desactivar' : 'Activar'} a ${
                              colaborador.nombre_completo
                            }`}
                            className={`p-1.5 rounded-lg transition-all ${
                              activo
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarColaborador(colaborador)}
                            title="Eliminar colaborador"
                            aria-label={`Eliminar a ${colaborador.nombre_completo}`}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* Ficha completa del empleado */}
      <Modal
        abierto={Boolean(ficha)}
        onClose={() => setFicha(null)}
        icono={<Users size={20} />}
        titulo="Ficha del colaborador"
        subtitulo="Información personal, laboral y de contacto."
        ancho="max-w-2xl"
      >
        {ficha && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="w-14 h-14 shrink-0 rounded-full bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl font-black">
                {(ficha.nombre_completo || 'C').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-white truncate">{ficha.nombre_completo}</h3>
                <p className="text-xs text-slate-400">
                  {ficha.rol || 'Sin rol'} · {ficha.departamento || 'General'}
                </p>
              </div>
              <span
                className={`self-start sm:self-center px-3 py-1 rounded-lg text-[10px] font-bold border ${
                  ficha.activo !== false
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                }`}
              >
                {ficha.activo !== false ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
              <Dato etiqueta="Documento" valor={ficha.documento_id} mono />
              <Dato etiqueta="Fecha de nacimiento" valor={formatFecha(ficha.fecha_nacimiento)} />
              <Dato etiqueta="Teléfono" valor={ficha.telefono} mono />
              <Dato etiqueta="Correo personal" valor={ficha.email_personal} />
              <Dato etiqueta="Ciudad" valor={ficha.ciudad} />
              <Dato etiqueta="Dirección" valor={ficha.direccion} />
              <Dato etiqueta="Fecha de ingreso" valor={formatFecha(ficha.fecha_ingreso)} />
              <Dato etiqueta="Tipo de contrato" valor={ficha.tipo_contrato} />
              <Dato etiqueta="Salario" valor={formatCOP(ficha.salario)} mono />
              <Dato etiqueta="EPS" valor={ficha.eps} />
              <Dato etiqueta="ARL" valor={ficha.arl} />
              <Dato
                etiqueta="Contacto de emergencia"
                valor={
                  ficha.contacto_emergencia_nombre
                    ? `${ficha.contacto_emergencia_nombre}${
                        ficha.contacto_emergencia_telefono
                          ? ` · ${ficha.contacto_emergencia_telefono}`
                          : ''
                      }`
                    : ''
                }
              />
              <Dato
                etiqueta="Dotación"
                valor={[
                  ficha.talla_camisa ? `Camisa ${ficha.talla_camisa}` : '',
                  ficha.talla_pantalon ? `Pantalón ${ficha.talla_pantalon}` : '',
                  ficha.talla_calzado ? `Calzado ${ficha.talla_calzado}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
              <Dato etiqueta="Registrado en el sistema" valor={formatFecha(ficha.creado_en)} />
            </div>

            {ficha.notas && (
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Notas
                </p>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">
                  {ficha.notas}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => alternarActivo(ficha)}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  ficha.activo !== false
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {ficha.activo !== false ? 'Desactivar' : 'Activar'}
              </button>
              <button
                type="button"
                onClick={() => abrirEditar(ficha)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-colors"
              >
                <Edit2 size={14} /> Editar ficha
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        abierto={Boolean(colaboradorContrasena)}
        onClose={cerrarRestablecimiento}
        icono={<KeyRound size={20} />}
        titulo="Restablecer contraseña"
        subtitulo={
          colaboradorContrasena
            ? `Define una nueva contraseña para ${colaboradorContrasena.nombre_completo}. No se necesita la contraseña anterior.`
            : ''
        }
      >
        <form onSubmit={restablecerContrasena} className="space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-[11px] leading-relaxed text-amber-200">
            Comunica la nueva contraseña al colaborador por un canal seguro. No la envíes en un
            mensaje grupal ni la compartas con otras personas.
          </div>
          {errorContrasena && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {errorContrasena}
            </div>
          )}
          <Campo
            id="colaborador-nueva-contrasena"
            etiqueta="Nueva contraseña"
            ayuda="Debe tener al menos 8 caracteres."
          >
            <input
              id="colaborador-nueva-contrasena"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={nuevaContrasena}
              onChange={(evento) => setNuevaContrasena(evento.target.value)}
              className={claseInput}
              required
              disabled={restableciendoContrasena}
            />
          </Campo>
          <Campo id="colaborador-confirmar-contrasena" etiqueta="Confirmar nueva contraseña">
            <input
              id="colaborador-confirmar-contrasena"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmarContrasena}
              onChange={(evento) => setConfirmarContrasena(evento.target.value)}
              className={claseInput}
              required
              disabled={restableciendoContrasena}
            />
          </Campo>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cerrarRestablecimiento}
              disabled={restableciendoContrasena}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={restableciendoContrasena}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
            >
              <KeyRound size={14} aria-hidden="true" />
              {restableciendoContrasena ? 'Restableciendo...' : 'Guardar nueva contraseña'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Formulario crear / editar */}
      <Modal
        abierto={modalAbierto}
        onClose={() => setModalAbierto(false)}
        icono={<UserPlus size={20} />}
        titulo={editando ? 'Editar Colaborador' : 'Registrar Nuevo Colaborador'}
        subtitulo={
          editando
            ? 'El documento de identidad no se puede modificar.'
            : 'El documento será su usuario de acceso al sistema.'
        }
        ancho="max-w-3xl"
      >
        <form onSubmit={handleGuardar} className="space-y-6">
          {errorForm && (
            <div
              role="alert"
              className="p-3 rounded-xl text-xs bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
            >
              <AlertCircle size={16} className="shrink-0" />
              {errorForm}
            </div>
          )}

          <Seccion icono={<UserPlus size={16} />} titulo="Datos personales y acceso">
            <div className="sm:col-span-2">
              <Campo id="colab-nombre" etiqueta="Nombre completo *">
                <input
                  id="colab-nombre"
                  type="text"
                  value={form.nombreCompleto}
                  onChange={(evento) => actualizarCampo('nombreCompleto', evento.target.value)}
                  placeholder="Ej. Kivin Dirlian"
                  className={claseInput}
                  required
                />
              </Campo>
            </div>

            <Campo id="colab-documento" etiqueta="Documento (usuario) *">
              <input
                id="colab-documento"
                type="text"
                inputMode="numeric"
                value={form.documento}
                onChange={(evento) => actualizarCampo('documento', soloDigitos(evento.target.value))}
                placeholder="Ej. 1077000000"
                disabled={Boolean(editando)}
                className={`${claseInput} font-mono`}
                required
              />
            </Campo>

            {editando ? (
              <div>
                <span className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</span>
                <div className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500">
                  El colaborador la gestiona desde Mi Perfil
                </div>
              </div>
            ) : (
              <Campo id="colab-password" etiqueta="Contraseña de acceso *">
                <input
                  id="colab-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(evento) => actualizarCampo('password', evento.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={claseInput}
                  required={!editando}
                />
              </Campo>
            )}

            <Campo id="colab-nacimiento" etiqueta="Fecha de nacimiento">
              <input
                id="colab-nacimiento"
                type="date"
                value={form.fechaNacimiento}
                onChange={(evento) => actualizarCampo('fechaNacimiento', evento.target.value)}
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-telefono" etiqueta="Teléfono / WhatsApp">
              <input
                id="colab-telefono"
                type="tel"
                value={form.telefono}
                onChange={(evento) => actualizarCampo('telefono', evento.target.value)}
                placeholder="3110000000"
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-email" etiqueta="Correo personal">
              <input
                id="colab-email"
                type="email"
                value={form.emailPersonal}
                onChange={(evento) => actualizarCampo('emailPersonal', evento.target.value)}
                placeholder="correo@ejemplo.com"
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-ciudad" etiqueta="Ciudad / municipio">
              <input
                id="colab-ciudad"
                type="text"
                value={form.ciudad}
                onChange={(evento) => actualizarCampo('ciudad', evento.target.value)}
                placeholder="Quibdó"
                className={claseInput}
              />
            </Campo>

            <div className="sm:col-span-2">
              <Campo id="colab-direccion" etiqueta="Dirección de residencia">
                <input
                  id="colab-direccion"
                  type="text"
                  value={form.direccion}
                  onChange={(evento) => actualizarCampo('direccion', evento.target.value)}
                  placeholder="Barrio, calle, número y referencia"
                  className={claseInput}
                />
              </Campo>
            </div>
          </Seccion>

          <Seccion icono={<Briefcase size={16} />} titulo="Contrato y cargo">
            <Campo id="colab-rol" etiqueta="Rol en el taller">
              <select
                id="colab-rol"
                value={form.rol}
                onChange={(evento) => actualizarCampo('rol', evento.target.value)}
                className={claseInput}
              >
                {ROLES_LIST.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="colab-departamento" etiqueta="Departamento / área">
              <select
                id="colab-departamento"
                value={form.departamento}
                onChange={(evento) => actualizarCampo('departamento', evento.target.value)}
                className={claseInput}
              >
                {DEPARTAMENTOS.map((departamento) => (
                  <option key={departamento} value={departamento}>
                    {departamento}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="colab-contrato" etiqueta="Tipo de contrato">
              <select
                id="colab-contrato"
                value={form.tipoContrato}
                onChange={(evento) => actualizarCampo('tipoContrato', evento.target.value)}
                className={claseInput}
              >
                <option value="">Selecciona una opción...</option>
                {TIPOS_CONTRATO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="colab-ingreso" etiqueta="Fecha de ingreso">
              <input
                id="colab-ingreso"
                type="date"
                value={form.fechaIngreso}
                onChange={(evento) => actualizarCampo('fechaIngreso', evento.target.value)}
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-salario" etiqueta="Salario mensual (COP)">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                <input
                  id="colab-salario"
                  type="text"
                  inputMode="numeric"
                  value={form.salario}
                  onChange={(evento) => {
                    const numero = parseCOP(evento.target.value);
                    actualizarCampo('salario', numero ? formatMiles(numero) : '');
                  }}
                  placeholder="1.500.000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </Campo>

            <div className="flex items-end">
              <label
                htmlFor="colab-activo"
                className="w-full flex items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-200">
                    Colaborador activo
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {form.activo ? 'Puede operar en el sistema' : 'Sin acceso operativo'}
                  </span>
                </span>
                <input
                  id="colab-activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(evento) => actualizarCampo('activo', evento.target.checked)}
                  className="w-4 h-4 accent-emerald-500 shrink-0"
                />
              </label>
            </div>
          </Seccion>

          <Seccion icono={<HeartPulse size={16} />} titulo="Seguridad social y emergencia">
            <Campo id="colab-eps" etiqueta="EPS">
              <input
                id="colab-eps"
                type="text"
                value={form.eps}
                onChange={(evento) => actualizarCampo('eps', evento.target.value)}
                placeholder="Ej. Nueva EPS"
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-arl" etiqueta="ARL">
              <input
                id="colab-arl"
                type="text"
                value={form.arl}
                onChange={(evento) => actualizarCampo('arl', evento.target.value)}
                placeholder="Ej. ARL Sura"
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-emergencia-nombre" etiqueta="Contacto de emergencia">
              <input
                id="colab-emergencia-nombre"
                type="text"
                value={form.contactoEmergenciaNombre}
                onChange={(evento) =>
                  actualizarCampo('contactoEmergenciaNombre', evento.target.value)
                }
                placeholder="Nombre y parentesco"
                className={claseInput}
              />
            </Campo>

            <Campo id="colab-emergencia-telefono" etiqueta="Teléfono de emergencia">
              <input
                id="colab-emergencia-telefono"
                type="tel"
                value={form.contactoEmergenciaTelefono}
                onChange={(evento) =>
                  actualizarCampo('contactoEmergenciaTelefono', evento.target.value)
                }
                placeholder="3000000000"
                className={claseInput}
              />
            </Campo>
          </Seccion>

          <Seccion icono={<Shirt size={16} />} titulo="Dotación y notas">
            <Campo id="colab-talla-camisa" etiqueta="Talla de camisa">
              <select
                id="colab-talla-camisa"
                value={form.tallaCamisa}
                onChange={(evento) => actualizarCampo('tallaCamisa', evento.target.value)}
                className={claseInput}
              >
                <option value="">Sin registrar</option>
                {TALLAS.map((talla) => (
                  <option key={talla} value={talla}>
                    {talla}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="colab-talla-pantalon" etiqueta="Talla de pantalón">
              <select
                id="colab-talla-pantalon"
                value={form.tallaPantalon}
                onChange={(evento) => actualizarCampo('tallaPantalon', evento.target.value)}
                className={claseInput}
              >
                <option value="">Sin registrar</option>
                {TALLAS.map((talla) => (
                  <option key={talla} value={talla}>
                    {talla}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo id="colab-talla-calzado" etiqueta="Talla de calzado">
              <select
                id="colab-talla-calzado"
                value={form.tallaCalzado}
                onChange={(evento) => actualizarCampo('tallaCalzado', evento.target.value)}
                className={claseInput}
              >
                <option value="">Sin registrar</option>
                {TALLAS_CALZADO.map((talla) => (
                  <option key={talla} value={talla}>
                    {talla}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="sm:col-span-2">
              <Campo
                id="colab-notas"
                etiqueta="Notas internas"
                ayuda="Solo visible para administradores y jefes de taller."
              >
                <textarea
                  id="colab-notas"
                  rows={3}
                  value={form.notas}
                  onChange={(evento) => actualizarCampo('notas', evento.target.value)}
                  placeholder="Observaciones, incapacidades, pendientes, etc."
                  className={`${claseInput} resize-y`}
                />
              </Campo>
            </div>
          </Seccion>

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
              {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Crear Colaborador'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
