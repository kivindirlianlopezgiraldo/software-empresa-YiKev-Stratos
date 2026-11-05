import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Box,
  Boxes,
  Building2,
  Globe,
  HardHat,
  Layers,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import { permisosDe, vistaInicial } from './lib/constants';
import { cerrarSesion as cerrarSesionAuth } from './lib/auth';
import { cargarNotificaciones } from './lib/notificaciones';

import Chatbot from './components/Chatbot';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Perfil from './pages/Perfil';
import Colaboradores from './pages/Colaboradores';
import Empresa from './pages/Empresa';
import SitioWeb from './pages/SitioWeb';
import Inventario from './pages/Inventario';
import InventarioProduccion from './pages/InventarioProduccion';
import Herramientas from './pages/Herramientas';
import Notificaciones from './pages/Notificaciones';
import OrdenesTrabajo from './pages/OrdenesTrabajo';
import SistemasTrabajo from './pages/SistemasTrabajo';

const MENU = [
  {
    id: 'dashboard',
    etiqueta: 'Dashboard General',
    Icono: LayoutDashboard,
    permitido: (p) => p.puedeVerDashboard,
  },
  {
    id: 'ordenes',
    etiqueta: 'Órdenes y Medidas',
    Icono: Wrench,
    permitido: () => true,
  },
  {
    id: 'sistemas',
    etiqueta: 'Sistemas y Recetas',
    Icono: Layers,
    permitido: (p) => p.puedeVerSistemas,
  },
  {
    id: 'produccion',
    etiqueta: 'Inventario de Producción',
    Icono: Boxes,
    permitido: (p) => p.puedeVerProduccion,
  },
  {
    id: 'herramientas',
    etiqueta: 'Herramientas y Checklists',
    Icono: HardHat,
    permitido: (p) => p.puedeVerHerramientas,
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario de Materiales',
    Icono: Box,
    permitido: (p) => p.puedeVerInventario,
  },
  {
    id: 'colaboradores',
    etiqueta: 'Empleados',
    Icono: Users,
    permitido: (p) => p.puedeAdministrar,
  },
  {
    id: 'empresa',
    etiqueta: 'Empresa',
    Icono: Building2,
    permitido: (p) => p.puedeAdministrar,
  },
  {
    id: 'sitio',
    etiqueta: 'Sitio web',
    Icono: Globe,
    permitido: (p) => p.puedeAdministrar,
  },
  {
    id: 'notificaciones',
    etiqueta: 'Notificaciones',
    Icono: Bell,
    permitido: () => true,
  },
  {
    id: 'perfil',
    etiqueta: 'Mi Perfil',
    Icono: UserCheck,
    permitido: () => true,
  },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [vistaActual, setVistaActual] = useState('dashboard');
  // Pantalla pública: el sitio web de la empresa o el formulario de acceso.
  const [pantallaPublica, setPantallaPublica] = useState('landing');
  // Orden que se abre automáticamente al llegar desde una notificación.
  const [ordenDestacada, setOrdenDestacada] = useState(null);
  const [noLeidas, setNoLeidas] = useState(0);
  // Evita resetear la vista cuando Supabase renueva el token o se reautentica
  const usuarioConVista = useRef(null);

  const cargarPerfil = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('perfiles_usuario')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    setPerfil(data ?? null);
    return data ?? null;
  }, []);

  // Sesión real de Supabase Auth (se restaura sola al recargar)
  useEffect(() => {
    let activo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      setSession(data.session ?? null);
      setCargando(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setSession(sesion ?? null);
      if (!sesion) setPerfil(null);
    });

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  // Perfil y vista inicial según el rol del organigrama
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      usuarioConVista.current = null;
      return undefined;
    }

    let activo = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('perfiles_usuario')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!activo) return;
        if (error) throw error;

        setPerfil(data ?? null);
        setErrorPerfil(
          data ? '' : 'Tu usuario no tiene un perfil asignado. Contacta al administrador.',
        );

        // Solo al entrar (o al cambiar de usuario) se elige la vista inicial.
        if (usuarioConVista.current !== userId) {
          usuarioConVista.current = userId;
          setVistaActual(vistaInicial(data?.rol));
        }
      } catch (error) {
        if (activo) setErrorPerfil(error.message || 'No se pudo cargar tu perfil.');
      }
    })();

    return () => {
      activo = false;
    };
  }, [session?.user?.id]);

  const recargarPerfil = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      await cargarPerfil(session.user.id);
      setErrorPerfil('');
    } catch (error) {
      setErrorPerfil(error.message);
    }
  }, [session, cargarPerfil]);

  const permisos = useMemo(() => permisosDe(perfil?.rol), [perfil?.rol]);
  const cuentaInactiva = Boolean(perfil && perfil.activo === false);

  const menuVisible = useMemo(
    () => (cuentaInactiva ? [] : MENU.filter((item) => item.permitido(permisos))),
    [cuentaInactiva, permisos],
  );

  // Nunca renderizar una vista que el rol no puede ver
  const vistaEfectiva = menuVisible.some((item) => item.id === vistaActual)
    ? vistaActual
    : menuVisible[0]?.id ?? 'perfil';

  const recargarContador = useCallback(async () => {
    if (!perfil?.id) {
      setNoLeidas(0);
      return;
    }
    try {
      const filas = await cargarNotificaciones(60);
      setNoLeidas(filas.filter((fila) => !fila.leida).length);
    } catch {
      // La migración 005 puede no estar aplicada todavía.
      setNoLeidas(0);
    }
  }, [perfil?.id]);

  useEffect(() => {
    if (!perfil?.id) return undefined;

    const inicial = setTimeout(recargarContador, 0);
    const temporizador = setInterval(recargarContador, 60000);
    return () => {
      clearTimeout(inicial);
      clearInterval(temporizador);
    };
  }, [perfil?.id, vistaEfectiva, recargarContador]);

  const abrirOrdenDesdeNotificacion = (ordenId) => {
    setOrdenDestacada(ordenId || null);
    setVistaActual('ordenes');
  };

  const handleCerrarSesion = async () => {
    await cerrarSesionAuth();
    setPerfil(null);
    setNoLeidas(0);
    setVistaActual('dashboard');
    setPantallaPublica('landing');
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="animate-pulse text-sm font-medium">Cargando YiKev Stratos ERP...</p>
      </div>
    );
  }

  if (!session) {
    if (pantallaPublica === 'login') {
      return <Login onVolver={() => setPantallaPublica('landing')} />;
    }

    return <Landing onIngresar={() => setPantallaPublica('login')} />;
  }

  const sinPerfil = !perfil;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Barra lateral */}
      <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-2 px-2">
            <div className="min-w-0">
              <h2 className="text-xl font-black text-blue-500">YiKev Stratos</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-1">
                {perfil?.rol || 'Sin rol asignado'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVistaActual('notificaciones')}
              title={
                noLeidas > 0
                  ? `${noLeidas} notificación(es) sin leer`
                  : 'Ver notificaciones'
              }
              aria-label={
                noLeidas > 0
                  ? `${noLeidas} notificaciones sin leer`
                  : 'Ver notificaciones'
              }
              className={`relative shrink-0 rounded-xl border p-2 transition-colors ${
                vistaEfectiva === 'notificaciones'
                  ? 'border-blue-500/40 bg-blue-600/20 text-blue-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Bell size={16} />
              {noLeidas > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white">
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
            </button>
          </div>

          <nav className="space-y-1" aria-label="Navegación principal">
            {menuVisible.map(({ id, etiqueta, Icono }) => (
              <button
                key={id}
                type="button"
                onClick={() => setVistaActual(id)}
                aria-current={vistaEfectiva === id ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  vistaEfectiva === id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icono size={18} /> <span className="flex-1 text-left">{etiqueta}</span>
                {id === 'notificaciones' && noLeidas > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {noLeidas > 99 ? '99+' : noLeidas}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-3">
          <button
            type="button"
            onClick={() => setVistaActual('perfil')}
            className="px-2 w-full text-left group"
          >
            <p className="text-xs font-bold text-white truncate group-hover:underline">
              {perfil?.nombre_completo || session.user?.email || 'Colaborador'}
            </p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] rounded-md font-semibold">
              {perfil?.rol || 'Rol Operativo'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleCerrarSesion}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all border border-red-500/20"
          >
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-8 overflow-y-auto">
        {sinPerfil ? (
          <div className="max-w-lg mx-auto mt-20 bg-slate-900 border border-red-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
              <ShieldAlert size={26} />
            </div>
            <h1 className="text-lg font-black text-white">Acceso sin perfil</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              {errorPerfil ||
                'Tu cuenta existe, pero no tiene un perfil asociado en el sistema. Pide a un administrador que te registre en Colaboradores.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                type="button"
                onClick={recargarPerfil}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={handleCerrarSesion}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        ) : cuentaInactiva ? (
          <div className="max-w-lg mx-auto mt-20 bg-slate-900 border border-amber-500/30 rounded-3xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldAlert size={26} />
            </div>
            <h1 className="text-lg font-black text-white">Acceso desactivado</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tu perfil está marcado como <strong className="text-slate-200">inactivo</strong> en el
              sistema. Si crees que es un error, contacta al administrador del taller para reactivar
              tu cuenta.
            </p>
            <button
              type="button"
              onClick={handleCerrarSesion}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            {vistaEfectiva === 'dashboard' && <Dashboard perfil={perfil} />}
            {vistaEfectiva === 'ordenes' && (
              <OrdenesTrabajo
                perfil={perfil}
                ordenInicialId={ordenDestacada}
                onOrdenAbierta={() => setOrdenDestacada(null)}
              />
            )}
            {vistaEfectiva === 'sistemas' && <SistemasTrabajo permisos={permisos} />}
            {vistaEfectiva === 'produccion' && (
              <InventarioProduccion perfil={perfil} permisos={permisos} />
            )}
            {vistaEfectiva === 'herramientas' && (
              <Herramientas perfil={perfil} permisos={permisos} />
            )}
            {vistaEfectiva === 'inventario' && <Inventario permisos={permisos} />}
            {vistaEfectiva === 'colaboradores' && <Colaboradores perfil={perfil} />}
            {vistaEfectiva === 'empresa' && <Empresa perfil={perfil} />}
            {vistaEfectiva === 'sitio' && <SitioWeb perfil={perfil} />}
            {vistaEfectiva === 'notificaciones' && (
              <Notificaciones onVerOrden={abrirOrdenDesdeNotificacion} onCambio={recargarContador} />
            )}
            {vistaEfectiva === 'perfil' && (
              <Perfil session={session} onActualizado={recargarPerfil} />
            )}
          </>
        )}
      </main>

      <Chatbot
        modo="empleado"
        contexto={{
          usuario: perfil?.nombre_completo || null,
          rol: perfil?.rol || null,
          vista: vistaEfectiva,
        }}
      />
    </div>
  );
}
