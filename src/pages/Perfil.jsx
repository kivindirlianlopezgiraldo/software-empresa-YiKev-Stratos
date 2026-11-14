import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Camera,
  CreditCard,
  Lock,
  Phone,
  Trash2,
  User,
  Wrench,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatCOP, formatFecha, nuevoId } from '../lib/format';
import { traducirErrorAuth, emailDesdeDocumento } from '../lib/auth';
import { categoriaRol, rolLegible } from '../lib/constants';

const PERFIL_INICIAL = {
  nombre_completo: '',
  foto_perfil: null,
  documento_id: '',
  telefono: '',
  rol: '',
  departamento: '',
  tipo_contrato: '',
  salario: 0,
};

export default function Perfil({ session, onActualizado }) {
  const [perfil, setPerfil] = useState(PERFIL_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState({ texto: '', tipo: '' });
  const [mensajePass, setMensajePass] = useState({ texto: '', tipo: '' });
  const [herramientas, setHerramientas] = useState([]);
  const [cargandoHerramientas, setCargandoHerramientas] = useState(false);
  const [errorHerramientas, setErrorHerramientas] = useState('');

  const [passwordActual, setPasswordActual] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  // La sesión ahora es una sesión real de Supabase Auth
  const userId = session?.user?.id;
  const email = session?.user?.email;
  const documento = perfil.documento_id || (email ? emailDesdeDocumento(email) : '');

  const consultarPerfil = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      try {
        if (!userId) return;
        const fila = await consultarPerfil(userId);
        if (!activo) return;
        if (fila) setPerfil({ ...PERFIL_INICIAL, ...fila });
      } catch (err) {
        if (activo) {
          setMensajePerfil({ texto: `No se pudo cargar tu perfil: ${err.message}`, tipo: 'error' });
        }
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [consultarPerfil, userId]);

  useEffect(() => {
    let activo = true;

    if (!userId || categoriaRol(perfil.rol) !== 'produccion') return undefined;

    (async () => {
      setCargandoHerramientas(true);
      setErrorHerramientas('');

      try {
        const { data, error } = await supabase
          .from('herramientas')
          .select('id, nombre, codigo, categoria, estado')
          .eq('colaborador_id', userId)
          .order('nombre', { ascending: true });

        if (error) throw error;
        if (activo) setHerramientas(data ?? []);
      } catch (error) {
        if (activo) {
          setHerramientas([]);
          setErrorHerramientas(`No se pudieron cargar tus herramientas: ${error.message}`);
        }
      } finally {
        if (activo) setCargandoHerramientas(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [perfil.rol, userId]);

  const handleActualizarPerfil = async (evento) => {
    evento.preventDefault();
    setGuardandoPerfil(true);
    setMensajePerfil({ texto: '', tipo: '' });

    try {
      if (!perfil.nombre_completo?.trim()) {
        throw new Error('El nombre completo es obligatorio.');
      }

      const { error } = await supabase
        .from('perfiles_usuario')
        .update({
          nombre_completo: perfil.nombre_completo.trim(),
          telefono: (perfil.telefono || '').trim(),
        })
        .eq('id', userId);

      if (error) throw error;

      setMensajePerfil({ texto: '¡Información personal actualizada con éxito!', tipo: 'exito' });
      if (onActualizado) await onActualizado();
    } catch (error) {
      setMensajePerfil({ texto: `Error al actualizar: ${error.message}`, tipo: 'error' });
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleFotoSeleccionada = async (evento) => {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;

    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(archivo.type)) {
      setMensajePerfil({
        texto: 'La foto debe estar en formato JPG, PNG o WEBP.',
        tipo: 'error',
      });
      return;
    }
    if (archivo.size > 3 * 1024 * 1024) {
      setMensajePerfil({ texto: 'La foto no puede pesar más de 3 MB.', tipo: 'error' });
      return;
    }
    if (!userId) return;

    setProcesandoFoto(true);
    setMensajePerfil({ texto: '', tipo: '' });
    const rutaAnterior = perfil.foto_perfil;
    const extension = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg';
    const rutaNueva = `${userId}/${nuevoId()}.${extension}`;

    try {
      const { error: errorSubida } = await supabase.storage
        .from('fotos-perfil')
        .upload(rutaNueva, archivo, { contentType: archivo.type, cacheControl: '3600' });
      if (errorSubida) throw errorSubida;

      const { error: errorPerfil } = await supabase
        .from('perfiles_usuario')
        .update({ foto_perfil: rutaNueva })
        .eq('id', userId);
      if (errorPerfil) {
        const { error: errorLimpieza } = await supabase.storage
          .from('fotos-perfil')
          .remove([rutaNueva]);
        if (errorLimpieza) {
          throw new Error(
            `${errorPerfil.message}. Además, no se pudo limpiar la foto subida: ${errorLimpieza.message}`,
          );
        }
        throw errorPerfil;
      }

      setPerfil((actual) => ({ ...actual, foto_perfil: rutaNueva }));
      if (rutaAnterior) {
        const { error: errorEliminarAnterior } = await supabase.storage
          .from('fotos-perfil')
          .remove([rutaAnterior]);
        if (errorEliminarAnterior) {
          setMensajePerfil({
            texto: `La foto se cambió, pero no se pudo eliminar la anterior: ${errorEliminarAnterior.message}`,
            tipo: 'error',
          });
        } else {
          setMensajePerfil({ texto: 'Foto de perfil actualizada.', tipo: 'exito' });
        }
      } else {
        setMensajePerfil({ texto: 'Foto de perfil actualizada.', tipo: 'exito' });
      }
      if (onActualizado) await onActualizado();
    } catch (error) {
      setMensajePerfil({ texto: `No se pudo actualizar la foto: ${error.message}`, tipo: 'error' });
    } finally {
      setProcesandoFoto(false);
    }
  };

  const handleEliminarFoto = async () => {
    if (!userId || !perfil.foto_perfil || procesandoFoto) return;
    setProcesandoFoto(true);
    setMensajePerfil({ texto: '', tipo: '' });

    try {
      const rutaAnterior = perfil.foto_perfil;
      const { error: errorPerfil } = await supabase
        .from('perfiles_usuario')
        .update({ foto_perfil: null })
        .eq('id', userId);
      if (errorPerfil) throw errorPerfil;

      setPerfil((actual) => ({ ...actual, foto_perfil: null }));
      const { error: errorEliminar } = await supabase.storage
        .from('fotos-perfil')
        .remove([rutaAnterior]);
      if (errorEliminar) {
        setMensajePerfil({
          texto: `La foto se quitó del perfil, pero no se pudo borrar el archivo: ${errorEliminar.message}`,
          tipo: 'error',
        });
      } else {
        setMensajePerfil({ texto: 'Foto de perfil eliminada.', tipo: 'exito' });
      }
      if (onActualizado) await onActualizado();
    } catch (error) {
      setMensajePerfil({ texto: `No se pudo eliminar la foto: ${error.message}`, tipo: 'error' });
    } finally {
      setProcesandoFoto(false);
    }
  };

  const handleCambiarPassword = async (evento) => {
    evento.preventDefault();
    setMensajePass({ texto: '', tipo: '' });

    if (!passwordActual) {
      setMensajePass({ texto: 'Debes escribir tu contraseña actual.', tipo: 'error' });
      return;
    }
    if (nuevoPassword !== confirmarPassword) {
      setMensajePass({ texto: 'Las nuevas contraseñas no coinciden.', tipo: 'error' });
      return;
    }
    if (nuevoPassword.length < 6) {
      setMensajePass({ texto: 'La contraseña debe tener al menos 6 caracteres.', tipo: 'error' });
      return;
    }
    if (nuevoPassword === passwordActual) {
      setMensajePass({ texto: 'La nueva contraseña debe ser distinta a la actual.', tipo: 'error' });
      return;
    }

    setGuardandoPass(true);
    try {
      // Verificar la contraseña actual volviendo a autenticarse
      const emailSesion = email || (documento ? emailDesdeDocumento(documento) : '');
      if (!emailSesion) throw new Error('No se pudo identificar tu usuario.');

      const { error: errorReautenticacion } = await supabase.auth.signInWithPassword({
        email: emailSesion,
        password: passwordActual,
      });
      if (errorReautenticacion) {
        throw new Error('La contraseña actual no es correcta.');
      }

      const { error } = await supabase.auth.updateUser({ password: nuevoPassword });
      if (error) throw error;

      setMensajePass({ texto: '¡Contraseña actualizada correctamente!', tipo: 'exito' });
      setPasswordActual('');
      setNuevoPassword('');
      setConfirmarPassword('');
    } catch (error) {
      setMensajePass({
        texto: error.message || traducirErrorAuth(error),
        tipo: 'error',
      });
    } finally {
      setGuardandoPass(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Cargando perfil de usuario...
      </div>
    );
  }

  const inicial = perfil.nombre_completo ? perfil.nombre_completo.charAt(0).toUpperCase() : 'U';
  const fotoPerfilUrl = perfil.foto_perfil
    ? supabase.storage.from('fotos-perfil').getPublicUrl(perfil.foto_perfil).data.publicUrl
    : '';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white">Mi Perfil y Seguridad</h1>
        <p className="text-xs text-slate-400 mt-1">
          Gestiona tu información personal, credenciales de acceso y datos de contrato.
        </p>
      </div>

      {categoriaRol(perfil.rol) === 'produccion' && (
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Wrench size={18} className="text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Mis herramientas asignadas</h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Herramientas que están actualmente a tu cargo.
                </p>
              </div>
            </div>
            {!cargandoHerramientas && !errorHerramientas && (
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300">
                {herramientas.length}
              </span>
            )}
          </div>

          {errorHerramientas ? (
            <p role="alert" className="px-5 py-4 text-xs text-red-300">
              {errorHerramientas}
            </p>
          ) : cargandoHerramientas ? (
            <p className="px-5 py-4 text-xs text-slate-400">Cargando tus herramientas...</p>
          ) : herramientas.length === 0 ? (
            <p className="px-5 py-4 text-xs text-slate-400">
              No tienes herramientas asignadas en este momento.
            </p>
          ) : (
            <ul className="grid gap-px bg-slate-800 sm:grid-cols-2">
              {herramientas.map((herramienta) => (
                <li
                  key={herramienta.id}
                  className="flex items-center justify-between gap-3 bg-slate-900 px-5 py-4"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Wrench size={15} className="mt-0.5 shrink-0 text-cyan-400" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{herramienta.nombre}</p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {herramienta.codigo || 'Sin código'} · {herramienta.categoria}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-300">
                    {herramienta.estado}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 text-center md:text-left flex flex-col items-center md:items-start">
          <div className="relative">
            {fotoPerfilUrl ? (
              <img
                src={fotoPerfilUrl}
                alt={`Foto de ${perfil.nombre_completo || 'usuario'}`}
                className="h-20 w-20 rounded-full border border-blue-500/30 object-cover shadow-lg"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-600/10 text-2xl font-black text-blue-500 shadow-lg">
                {inicial}
              </div>
            )}
          </div>
          <div className="min-w-0 w-full">
            <h2 className="text-base font-bold text-white truncate">
              {perfil.nombre_completo || 'Usuario'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{email || '—'}</p>
          </div>
          <div className="w-full pt-4 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Rol:</span>
              <span className="font-semibold text-blue-400 text-right">
                {rolLegible(perfil.rol) || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Departamento:</span>
              <span className="font-semibold text-slate-300 text-right">
                {perfil.departamento || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Contrato:</span>
              <span className="font-semibold text-emerald-400 text-right">
                {perfil.tipo_contrato || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Ingreso:</span>
              <span className="font-semibold text-slate-300 text-right">
                {formatFecha(perfil.fecha_ingreso)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">EPS / ARL:</span>
              <span className="font-semibold text-slate-300 text-right">
                {[perfil.eps, perfil.arl].filter(Boolean).join(' / ') || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Salario:</span>
              <span className="font-semibold text-slate-300 font-mono text-right">
                {formatCOP(perfil.salario)}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          {/* Datos personales */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <User size={18} className="text-blue-500" />
              <h3 className="text-sm font-bold text-white">Información Personal</h3>
            </div>

            {mensajePerfil.texto && (
              <div
                role="alert"
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  mensajePerfil.tipo === 'exito'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {mensajePerfil.tipo === 'exito' ? (
                  <CheckCircle size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                {mensajePerfil.texto}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500">
                <Camera size={15} />
                {procesandoFoto ? 'Procesando foto...' : perfil.foto_perfil ? 'Cambiar foto' : 'Subir foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFotoSeleccionada}
                  disabled={procesandoFoto}
                  className="sr-only"
                />
              </label>
              {perfil.foto_perfil && (
                <button
                  type="button"
                  onClick={handleEliminarFoto}
                  disabled={procesandoFoto}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Eliminar foto
                </button>
              )}
              <p className="text-[10px] text-slate-500">JPG, PNG o WEBP; máximo 3 MB.</p>
            </div>

            <form onSubmit={handleActualizarPerfil} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="nombre"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Nombre Completo
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    value={perfil.nombre_completo || ''}
                    onChange={(evento) =>
                      setPerfil((prev) => ({ ...prev, nombre_completo: evento.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="documento"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Número de Documento
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-3 text-slate-500" size={16} />
                    <input
                      id="documento"
                      type="text"
                      value={documento}
                      disabled
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="telefono" className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono de Contacto
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-500" size={16} />
                  <input
                    id="telefono"
                    type="tel"
                    value={perfil.telefono || ''}
                    onChange={(evento) =>
                      setPerfil((prev) => ({ ...prev, telefono: evento.target.value }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ej. 3225184192"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoPerfil}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {guardandoPerfil ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>

          {/* Contraseña */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock size={18} className="text-amber-500" />
              <h3 className="text-sm font-bold text-white">Seguridad y Contraseña</h3>
            </div>

            {mensajePass.texto && (
              <div
                role="alert"
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  mensajePass.tipo === 'exito'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {mensajePass.tipo === 'exito' ? (
                  <CheckCircle size={16} className="shrink-0" />
                ) : (
                  <AlertCircle size={16} className="shrink-0" />
                )}
                {mensajePass.texto}
              </div>
            )}

            <form onSubmit={handleCambiarPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="password-actual"
                  className="block text-xs font-semibold text-slate-300 mb-1"
                >
                  Contraseña Actual
                </label>
                <input
                  id="password-actual"
                  type="password"
                  autoComplete="current-password"
                  value={passwordActual}
                  onChange={(evento) => setPasswordActual(evento.target.value)}
                  placeholder="Tu contraseña actual"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="password-nueva"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Nueva Contraseña
                  </label>
                  <input
                    id="password-nueva"
                    type="password"
                    autoComplete="new-password"
                    value={nuevoPassword}
                    onChange={(evento) => setNuevoPassword(evento.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="password-confirmar"
                    className="block text-xs font-semibold text-slate-300 mb-1"
                  >
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    id="password-confirmar"
                    type="password"
                    autoComplete="new-password"
                    value={confirmarPassword}
                    onChange={(evento) => setConfirmarPassword(evento.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={guardandoPass}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
                >
                  {guardandoPass ? 'Actualizando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
