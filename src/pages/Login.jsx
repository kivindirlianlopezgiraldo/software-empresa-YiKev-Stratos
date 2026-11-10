import { useState } from 'react';
import { ArrowLeft, CreditCard, Eye, EyeOff, Lock, Shield, ShieldAlert } from 'lucide-react';

import { iniciarSesion } from '../lib/auth';

export default function Login({ onVolver }) {
  const [cedulaInput, setCedulaInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (evento) => {
    evento.preventDefault();
    setError('');

    const documento = cedulaInput.trim();
    const clave = passwordInput.trim();

    if (!documento || !clave) {
      setError('Por favor ingresa tu número de documento y contraseña.');
      return;
    }

    setCargando(true);
    try {
      await iniciarSesion(documento, clave);
      // La sesión se propaga por onAuthStateChange en App.jsx
    } catch (err) {
      setError(err.message || 'Ocurrió un error al iniciar sesión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
          >
            <ArrowLeft size={14} /> Volver al sitio web
          </button>
        )}

        <div className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
              <Shield size={28} />
            </div>
            <h1 className="text-xl font-black text-white tracking-wide">YiKev Stratos ERP</h1>
            <p className="text-xs text-slate-400 mt-1">
              Ingresa con tu número de documento de identidad
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 bg-red-950/80 border border-red-500/50 text-red-200 p-3.5 rounded-2xl text-xs flex items-center gap-3"
            >
              <ShieldAlert size={18} className="shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="documento" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número de Documento
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input
                  id="documento"
                  name="documento"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={cedulaInput}
                  onChange={(evento) => setCedulaInput(evento.target.value)}
                  placeholder="Ej. 1128524263"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input
                  id="password"
                  name="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(evento) => setPasswordInput(evento.target.value)}
                  placeholder="••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-11 py-3 text-xs text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((valor) => !valor)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3 top-2.5 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {cargando ? 'Verificando acceso...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-800/80 pt-4">
            <p className="text-[10px] text-slate-500">
              Taller de Aluminio, Vidrio, PVC y Acrílico • Quibdó, Chocó
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
