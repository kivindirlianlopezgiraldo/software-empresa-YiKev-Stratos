import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Lock,
  Phone,
  User,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { formatCOP, formatFecha } from '../lib/format';
import { traducirErrorAuth, emailDesdeDocumento } from '../lib/auth';

const PERFIL_INICIAL = {
  nombre_completo: '',
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
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState({ texto: '', tipo: '' });
  const [mensajePass, setMensajePass] = useState({ texto: '', tipo: '' });

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-black text-white">Mi Perfil y Seguridad</h1>
        <p className="text-xs text-slate-400 mt-1">
          Gestiona tu información personal, credenciales de acceso y datos de contrato.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 text-center md:text-left flex flex-col items-center md:items-start">
          <div className="w-20 h-20 bg-blue-600/10 border border-blue-500/20 text-blue-500 rounded-full flex items-center justify-center text-2xl font-black shadow-lg">
            {inicial}
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
              <span className="font-semibold text-blue-400 text-right">{perfil.rol || '—'}</span>
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
