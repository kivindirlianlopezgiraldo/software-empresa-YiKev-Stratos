import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Box,
  Boxes,
  Building2,
  CalendarClock,
  Calculator,
  ClipboardCheck,
  Globe,
  HardHat,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';

import { supabase } from './lib/supabase';
import { permisosDe, rolLegible, vistaInicial } from './lib/constants';
import { cerrarSesion as cerrarSesionAuth } from './lib/auth';
import { cargarNotificaciones } from './lib/notificaciones';
import { dentroDelHorarioLaboral } from './lib/horarioAcceso';

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
import PruebasSistema from './pages/PruebasSistema';
import DespieceCalculadora from './pages/DespieceCalculadora';

const ExtenderAccesoModal = lazy(() => import('./components/ExtenderAccesoModal'));

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
    id: 'despiece',
    etiqueta: 'Calculadora de Despiece',
    Icono: Calculator,
    permitido: (p) => p.puedeCalcularDespiece,
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
    id: 'pruebas',
    etiqueta: 'Pruebas configuradas',
    Icono: ClipboardCheck,
    permitido: (p) => p.esSuperAdmin,
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
  // Menú lateral en pantallas angostas (drawer).
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [accesoFueraHorario, setAccesoFueraHorario] = useState(false);
  const [relojHorario, setRelojHorario] = useState(() => Date.now());
  const [modalExtensionHorario, setModalExtensionHorario] = useState(false);
  const [extensionHorario, setExtensionHorario] = useState({
    usuarioId: null,
    venceEn: null,
    verificadaUsuario: null,
    error: '',
  });
  // Evita resetear la vista cuando Supabase renueva el token o se reautentica
  const usuarioConVista = useRef(null);
  const cierreHorarioUsuario = useRef(null);

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
  const rolExentoHorario = permisos.esAdmin || permisos.esJefe;
  const usuarioId = session?.user?.id;
  const extensionVerificada = rolExentoHorario || extensionHorario.verificadaUsuario === usuarioId;
  const extensionActiva =
    extensionHorario.usuarioId === usuarioId &&
    Date.parse(extensionHorario.venceEn || '') > relojHorario;
  const horarioAbierto =
    dentroDelHorarioLaboral(new Date(relojHorario)) || extensionActiva;
  const bloqueoPorHorario = Boolean(
    session &&
      perfil?.id === session.user.id &&
      !rolExentoHorario &&
      extensionVerificada &&
      !horarioAbierto,
  );

  useEffect(() => {
    if (!usuarioId || perfil?.id !== usuarioId) return undefined;
    if (rolExentoHorario) return undefined;

    let activo = true;
    const consultarExtension = async () => {
      const { data, error } = await supabase
        .from('herramienta_accesos_extendidos')
        .select('vence_en')
        .eq('usuario_id', usuarioId)
        .gt('vence_en', new Date().toISOString())
        .order('vence_en', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activo) return;
      setExtensionHorario({
        usuarioId,
        venceEn: error ? null : data?.vence_en ?? null,
        verificadaUsuario: usuarioId,
        error: error?.message || '',
      });
    };
    consultarExtension();
    const intervalo = setInterval(consultarExtension, 15000);
    window.addEventListener('focus', consultarExtension);

    return () => {
      activo = false;
      clearInterval(intervalo);
      window.removeEventListener('focus', consultarExtension);
    };
  }, [usuarioId, perfil?.id, rolExentoHorario]);

  useEffect(() => {
    const revisarHorario = () => setRelojHorario(Date.now());
    const intervalo = setInterval(revisarHorario, 15000);
    window.addEventListener('focus', revisarHorario);
    document.addEventListener('visibilitychange', revisarHorario);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', revisarHorario);
      document.removeEventListener('visibilitychange', revisarHorario);
    };
  }, []);

  useEffect(() => {
    if (!usuarioId || perfil?.id !== usuarioId || !extensionVerificada) return;

    if (rolExentoHorario || horarioAbierto) {
      cierreHorarioUsuario.current = null;
      return;
    }

    if (cierreHorarioUsuario.current === usuarioId) return;
    cierreHorarioUsuario.current = usuarioId;
    setAccesoFueraHorario(true);
    setPantallaPublica('login');

    (async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setErrorPerfil(`El horario laboral terminó y no se pudo cerrar la sesión: ${error.message}`);
      }
    })();
  }, [usuarioId, perfil?.id, rolExentoHorario, horarioAbierto, extensionVerificada]);

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
    setMenuAbierto(false);
  };

  // Cerrar el menú lateral con Escape (accesibilidad por teclado).
  useEffect(() => {
    if (!menuAbierto) return undefined;

    const alPresionar = (evento) => {
      if (evento.key === 'Escape') setMenuAbierto(false);
    };

    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [menuAbierto]);

  const handleCerrarSesion = async () => {
    await cerrarSesionAuth();
    setPerfil(null);
    setNoLeidas(0);
    setVistaActual('dashboard');
    setPantallaPublica('landing');
    setAccesoFueraHorario(false);
  };

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="animate-pulse text-sm font-medium">Cargando YiKev Stratos ERP...</p>
      </div>
    );
  }

  if (
    session &&
    (!perfil || perfil.id !== session.user.id || (!rolExentoHorario && !extensionVerificada)) &&
    !errorPerfil
  ) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p className="animate-pulse text-sm font-medium">Verificando horario de acceso...</p>
      </div>
    );
  }

  if (accesoFueraHorario || bloqueoPorHorario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <section className="w-full max-w-md space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <ShieldAlert size={22} />
          </div>
          <h1 className="text-lg font-black text-white">Acceso fuera del horario laboral</h1>
          <p className="text-xs leading-5 text-slate-300">
            {session
              ? 'La jornada terminó y estamos cerrando tu sesión. '
              : 'Tu sesión se cerró automáticamente. '}
            El acceso para colaboradores está habilitado de lunes a viernes de 8:00 a. m. a
            6:00 p. m. y los sábados de 8:00 a. m. a 2:00 p. m., hora de Colombia. Los domingos
            no hay acceso.
          </p>
          {errorPerfil && (
            <p role="alert" className="text-xs text-red-300">{errorPerfil}</p>
          )}
          {!session && (
            <button
              type="button"
              onClick={() => {
                setAccesoFueraHorario(false);
                setErrorPerfil('');
              }}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500"
            >
              Volver
            </button>
          )}
        </section>
      </main>
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
    <div className="min-h-screen bg-slate-950 text-white lg:flex">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[120] focus:rounded-xl focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white focus:shadow-lg"
      >
        Saltar al contenido
      </a>

      {/* Fondo oscuro del menú móvil */}
      {menuAbierto && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuAbierto(false)}
          aria-hidden="true"
        />
      )}

      {/* Barra lateral: fija en escritorio, deslizable en móvil */}
      <aside
        id="menu-lateral"
        aria-label="Menú lateral"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-800 bg-slate-900 p-4 transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full shadow-2xl lg:shadow-none'
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-2">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-blue-500">YiKev Stratos</h2>
            <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {rolLegible(perfil?.rol) || 'Sin rol asignado'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setVistaActual('notificaciones');
                setMenuAbierto(false);
              }}
              title={
                noLeidas > 0 ? `${noLeidas} notificación(es) sin leer` : 'Ver notificaciones'
              }
              aria-label={
                noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : 'Ver notificaciones'
              }
              className={`relative rounded-xl border p-2 transition-colors ${
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
            <button
              type="button"
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 transition-colors hover:text-white lg:hidden"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <nav
          className="mt-6 flex-1 space-y-1 overflow-y-auto overscroll-contain pb-4"
          aria-label="Navegación principal"
        >
          {menuVisible.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setVistaActual(id);
                setMenuAbierto(false);
              }}
              aria-current={vistaEfectiva === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                vistaEfectiva === id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icono size={18} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 break-words">{etiqueta}</span>
              {id === 'notificaciones' && noLeidas > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                  {noLeidas > 99 ? '99+' : noLeidas}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-2 space-y-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => {
              setVistaActual('perfil');
              setMenuAbierto(false);
            }}
            className="group w-full rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex items-center gap-2.5">
              {perfil?.foto_perfil ? (
                <img
                  src={supabase.storage.from('fotos-perfil').getPublicUrl(perfil.foto_perfil).data.publicUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-600/10 text-xs font-black text-blue-300">
                  {(perfil?.nombre_completo || 'C').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-white group-hover:underline">
                  {perfil?.nombre_completo || session.user?.email || 'Colaborador'}
                </span>
                <span className="mt-1 inline-block rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  {rolLegible(perfil?.rol) || 'Rol Operativo'}
                </span>
              </span>
            </span>
          </button>

          {(permisos.esAdmin || permisos.esJefe) && (
            <button
              type="button"
              onClick={() => setModalExtensionHorario(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <CalendarClock size={16} /> Extender acceso
            </button>
          )}
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Columna de contenido */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* Barra superior solo en móvil / tablet */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={menuAbierto}
            aria-controls="menu-lateral"
            className="shrink-0 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight text-blue-500">
              YiKev Stratos
            </p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {rolLegible(perfil?.rol) || 'Sin rol asignado'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setVistaActual('notificaciones')}
            aria-label={
              noLeidas > 0 ? `${noLeidas} notificaciones sin leer` : 'Ver notificaciones'
            }
            className="relative shrink-0 rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Bell size={17} />
            {noLeidas > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white">
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            )}
          </button>
        </header>

        <main
          id="contenido-principal"
          tabIndex={-1}
          className="w-full min-w-0 flex-1 p-3 pb-24 focus:outline-none sm:p-5 sm:pb-24 lg:p-8 lg:pb-8"
        >
          {sinPerfil ? (
            <div className="mx-auto mt-10 max-w-lg space-y-4 rounded-3xl border border-red-500/30 bg-slate-900 p-6 text-center sm:mt-20 sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                <ShieldAlert size={26} />
              </div>
              <h1 className="text-lg font-black text-white">Acceso sin perfil</h1>
              <p className="text-xs leading-relaxed text-slate-400">
                {errorPerfil ||
                  'Tu cuenta existe, pero no tiene un perfil asociado en el sistema. Pide a un administrador que te registre en Colaboradores.'}
              </p>
              <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={recargarPerfil}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-blue-500"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={handleCerrarSesion}
                  className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : cuentaInactiva ? (
            <div className="mx-auto mt-10 max-w-lg space-y-4 rounded-3xl border border-amber-500/30 bg-slate-900 p-6 text-center sm:mt-20 sm:p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <ShieldAlert size={26} />
              </div>
              <h1 className="text-lg font-black text-white">Acceso desactivado</h1>
              <p className="text-xs leading-relaxed text-slate-400">
                Tu perfil está marcado como{' '}
                <strong className="text-slate-200">inactivo</strong> en el sistema. Si crees que es
                un error, contacta al administrador del taller para reactivar tu cuenta.
              </p>
              <button
                type="button"
                onClick={handleCerrarSesion}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
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
              {vistaEfectiva === 'despiece' && permisos.puedeCalcularDespiece && (
                <DespieceCalculadora permisos={permisos} />
              )}
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
              {vistaEfectiva === 'pruebas' && permisos.esSuperAdmin && <PruebasSistema />}
              {vistaEfectiva === 'notificaciones' && (
                <Notificaciones
                  onVerOrden={abrirOrdenDesdeNotificacion}
                  onCambio={recargarContador}
                />
              )}
              {vistaEfectiva === 'perfil' && (
                <Perfil session={session} onActualizado={recargarPerfil} />
              )}
            </>
          )}
        </main>
      </div>

      <Chatbot
        modo="empleado"
        contexto={{
          usuario: perfil?.nombre_completo || null,
          rol: perfil?.rol || null,
          vista: vistaEfectiva,
        }}
      />
      {(permisos.esAdmin || permisos.esJefe) && modalExtensionHorario ? (
        <Suspense fallback={null}>
          <ExtenderAccesoModal
            abierto
            perfil={perfil}
            onClose={() => setModalExtensionHorario(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
