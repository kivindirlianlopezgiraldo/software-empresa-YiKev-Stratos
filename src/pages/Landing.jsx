import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  Factory,
  FileText,
  Frame,
  Images,
  Layers,
  LogIn,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Quote,
  Ruler,
  Send,
  ShieldCheck,
  ShowerHead,
  Star,
  Wrench,
  X,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { urlImagenProyecto } from '../lib/proyectos';
import Modal from '../components/Modal';
import Chatbot from '../components/Chatbot';

const EMPRESA_BASE = {
  nombre_comercial: 'YiKev Stratos',
  razon_social: '',
  nit: '',
  digito_verificacion: '',
  direccion: '',
  ciudad: 'Quibdó',
  departamento_geografico: 'Chocó',
  telefono: '',
  celular: '',
  email: '',
  sitio_web: '',
  horario: 'Lunes a viernes: 8:00 a.m. – 6:00 p.m. · Sábados: 8:00 a.m. – 12:00 m.',
};

const SITIO_BASE = {
  hero_etiqueta: 'Taller en Quibdó, Chocó',
  hero_titulo: 'Espacios que se sienten',
  hero_destacado: 'a medida.',
  hero_texto:
    'Diseñamos, fabricamos e instalamos ventanas, puertas, fachadas y divisiones en aluminio, vidrio templado, PVC y acrílico. Precisión de taller, materiales de calidad y acabados que duran.',
  hero_beneficios: 'Medición en sitio|Fabricación propia|Instalación garantizada',
  nosotros_titulo: 'Oficio, técnica y acabados que se notan',
  nosotros_texto:
    'Somos un taller de Quibdó especializado en carpintería de aluminio y vidrio. Trabajamos con medidas exactas, materiales seleccionados y un equipo propio que acompaña el proyecto hasta la instalación.',
  proyectos_titulo: 'Proyectos realizados',
  proyectos_texto:
    'Una muestra de los trabajos que hemos entregado en vivienda, comercio y obra. Cada proyecto se mide, se fabrica y se instala con el mismo cuidado.',
  mostrar_proyectos: true,
  proyectos_limite: 6,
  contacto_titulo: 'Cuéntanos qué necesitas',
  contacto_texto:
    'Escríbenos con las medidas aproximadas, el tipo de trabajo y la ciudad. Te respondemos con los siguientes pasos.',
  whatsapp_mensaje: 'Hola, quiero cotizar un proyecto en aluminio y vidrio.',
};

const ENLACES = [
  { etiqueta: 'Servicios', href: '#servicios' },
  { etiqueta: 'Soluciones', href: '#soluciones' },
  { etiqueta: 'Proyectos', href: '#proyectos' },
  { etiqueta: 'Proceso', href: '#proceso' },
  { etiqueta: 'Nosotros', href: '#nosotros' },
  { etiqueta: 'Contacto', href: '#contacto' },
];

const BENEFICIOS = [
  {
    icono: Ruler,
    titulo: 'Medición en sitio',
    detalle: 'Tomamos medidas exactas antes de fabricar.',
  },
  {
    icono: Factory,
    titulo: 'Fabricación propia',
    detalle: 'Corte y ensamble en nuestro taller.',
  },
  {
    icono: ShieldCheck,
    titulo: 'Instalación garantizada',
    detalle: 'Equipo propio y acabados limpios.',
  },
  {
    icono: MapPin,
    titulo: 'Cobertura en Chocó',
    detalle: 'Quibdó y municipios cercanos.',
  },
];

const SERVICIOS = [
  {
    icono: Frame,
    titulo: 'Aluminio arquitectónico',
    descripcion:
      'Ventanería, puertas, fachadas y divisiones con perfiles de alta resistencia y acabados duraderos.',
    items: ['Ventanas corredizas y proyectantes', 'Puertas y ventanales', 'Fachadas y muros cortina'],
  },
  {
    icono: Layers,
    titulo: 'Vidrio y templados',
    descripcion:
      'Vidrio claro, laminado y templado para espacios seguros, luminosos y con diseño limpio.',
    items: ['Puertas en vidrio templado', 'Divisiones de baño', 'Barandas y espejos a medida'],
  },
  {
    icono: DoorOpen,
    titulo: 'PVC y acrílico',
    descripcion:
      'Soluciones livianas y de bajo mantenimiento para vivienda, comercio y proyectos especiales.',
    items: ['Ventanas en PVC', 'Mamparas y paneles', 'Letreros y piezas en acrílico'],
  },
  {
    icono: Wrench,
    titulo: 'Instalación y mantenimiento',
    descripcion:
      'Acompañamiento completo: desmonte, ajuste, sellado y revisión final de cada trabajo.',
    items: ['Instalación en obra', 'Cambio de herrajes', 'Ajustes y sellado'],
  },
];

const SOLUCIONES = [
  {
    icono: Frame,
    titulo: 'Ventanería a medida',
    texto:
      'Ventanas corredizas, proyectantes y fijas pensadas para la luz, la ventilación y el uso real de cada espacio.',
    items: ['Línea 5020 y 3835', 'Vidrio claro o templado', 'Mosquitero y herrajes'],
    gradiente: 'from-blue-500/30 via-sky-500/10 to-slate-950',
  },
  {
    icono: ShowerHead,
    titulo: 'Divisiones de baño',
    texto:
      'Paneles en vidrio templado con bisagras y accesorios de acero inoxidable para baños modernos y funcionales.',
    items: ['Templado de 8 mm', 'Puerta abatible o corrediza', 'Sellado sanitario'],
    gradiente: 'from-cyan-400/25 via-teal-500/10 to-slate-950',
  },
  {
    icono: Building2,
    titulo: 'Fachadas y puertas',
    texto:
      'Fachadas flotantes, puertas de acceso y cerramientos que le dan identidad y presencia a tu proyecto.',
    items: ['Muro cortina', 'Puertas de vidrio', 'Perfiles estructurales'],
    gradiente: 'from-indigo-500/30 via-blue-500/10 to-slate-950',
  },
];

const PROCESO = [
  {
    icono: Ruler,
    titulo: 'Visita y medición',
    texto: 'Vamos al lugar, revisamos el espacio y tomamos las medidas exactas.',
  },
  {
    icono: FileText,
    titulo: 'Diseño y cotización',
    texto: 'Definimos materiales, acabados y te entregamos una cotización clara.',
  },
  {
    icono: Factory,
    titulo: 'Fabricación en taller',
    texto: 'Cortamos, ensamblamos y revisamos cada pieza antes de la instalación.',
  },
  {
    icono: Wrench,
    titulo: 'Instalación y entrega',
    texto: 'Instalamos, ajustamos y dejamos el espacio listo para usar.',
  },
];

const COMPROMISOS = [
  'Medición y asesoría sin compromiso',
  'Materiales seleccionados para cada proyecto',
  'Cotización detallada antes de empezar',
  'Instalación con equipo propio',
  'Soporte después de la entrega',
];

function Marca() {
  return (
    <a href="#inicio" className="group flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 via-sky-400 to-cyan-300 text-base font-black text-slate-950 shadow-lg shadow-blue-500/25"
      >
        Y
        <span className="pointer-events-none absolute inset-x-1 top-1 h-1/3 rounded-t-lg bg-white/25" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-black tracking-tight text-white">YiKev Stratos</span>
        <span className="block text-[9px] uppercase tracking-[0.22em] text-slate-400">
          Aluminio · Vidrio · PVC
        </span>
      </span>
    </a>
  );
}

function PlanoTecnico() {
  return (
    <div className="relative mx-auto w-full max-w-[430px]">
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-3 shadow-2xl shadow-blue-950/40 backdrop-blur">
        <div className="overflow-hidden rounded-[1.4rem] border border-white/5 bg-[#0b1220]">
          <svg viewBox="0 0 420 520" role="img" aria-label="Plano técnico de una ventana corrediza a medida" className="h-full w-full">
            <defs>
              <linearGradient id="vidrioPlano" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="brilloPlano" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <pattern id="cuadriculaPlano" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
              </pattern>
            </defs>

            <rect width="420" height="520" fill="#0b1220" />
            <rect width="420" height="520" fill="url(#cuadriculaPlano)" />

            <path d="M 80 70 L 340 70 L 340 450 L 80 450 Z" fill="url(#vidrioPlano)" stroke="#60a5fa" strokeWidth="3" />
            <path d="M 92 82 L 328 82 L 328 438 L 92 438 Z" fill="none" stroke="#334155" strokeWidth="2" />
            <line x1="210" y1="70" x2="210" y2="450" stroke="#60a5fa" strokeWidth="5" />
            <line x1="80" y1="260" x2="340" y2="260" stroke="#334155" strokeWidth="2" />
            <path d="M 110 100 L 190 100 L 110 220 Z" fill="url(#brilloPlano)" />
            <path d="M 230 300 L 320 300 L 230 400 Z" fill="url(#brilloPlano)" opacity="0.6" />

            <line x1="56" y1="70" x2="56" y2="450" stroke="#38bdf8" strokeDasharray="4 4" strokeWidth="1.2" />
            <line x1="48" y1="70" x2="64" y2="70" stroke="#38bdf8" strokeWidth="1.2" />
            <line x1="48" y1="450" x2="64" y2="450" stroke="#38bdf8" strokeWidth="1.2" />
            <text x="42" y="260" fill="#7dd3fc" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle" transform="rotate(-90 42 260)">
              2.10 m
            </text>

            <line x1="80" y1="476" x2="340" y2="476" stroke="#38bdf8" strokeDasharray="4 4" strokeWidth="1.2" />
            <line x1="80" y1="468" x2="80" y2="484" stroke="#38bdf8" strokeWidth="1.2" />
            <line x1="340" y1="468" x2="340" y2="484" stroke="#38bdf8" strokeWidth="1.2" />
            <text x="210" y="498" fill="#7dd3fc" fontSize="11" fontFamily="ui-monospace, monospace" textAnchor="middle">
              1.80 m
            </text>

            <text x="80" y="42" fill="#64748b" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="2">
              YK · DETALLE DE VENTANA
            </text>
            <text x="340" y="42" fill="#38bdf8" fontSize="9" fontFamily="ui-monospace, monospace" textAnchor="end">
              01 / 01
            </text>

            <circle cx="340" cy="70" r="4" fill="#38bdf8" />
            <circle cx="340" cy="450" r="4" fill="#38bdf8" />
            <circle cx="80" cy="70" r="4" fill="#38bdf8" />
            <circle cx="80" cy="450" r="4" fill="#38bdf8" />
          </svg>
        </div>
      </div>

      <div className="absolute -left-3 top-8 hidden items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 shadow-xl backdrop-blur sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
          <Ruler size={15} />
        </span>
        <div>
          <p className="text-[10px] font-bold text-white">Medición precisa</p>
          <p className="text-[9px] text-slate-400">Antes de fabricar</p>
        </div>
      </div>

      <div className="absolute -bottom-4 right-0 hidden items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 shadow-xl backdrop-blur sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <ShieldCheck size={15} />
        </span>
        <div>
          <p className="text-[10px] font-bold text-white">Instalación</p>
          <p className="text-[9px] text-slate-400">Con garantía</p>
        </div>
      </div>
    </div>
  );
}

function Encabezado({ eyebrow, titulo, texto, centrado = false }) {
  return (
    <div className={`${centrado ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} space-y-3`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-400">{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">{titulo}</h2>
      {texto && <p className="text-sm leading-relaxed text-slate-400">{texto}</p>}
    </div>
  );
}

function TarjetaSolucion({ icono: Icono, titulo, texto, items, gradiente }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-2xl hover:shadow-blue-950/40">
      <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${gradiente}`}>
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.18),transparent_45%)]" />
        <Icono
          size={150}
          strokeWidth={0.7}
          className="absolute -bottom-8 -right-6 text-white/10 transition-transform duration-500 group-hover:scale-110"
        />
        <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-slate-950/40 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur">
          A medida
        </span>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-bold text-white">{titulo}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{texto}</p>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-2 text-[11px] text-slate-300">
              <Check size={13} className="shrink-0 text-sky-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function DatoContacto({ icono: Icono, etiqueta, valor, href }) {
  const contenido = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
        <Icono size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {etiqueta}
        </span>
        <span className="mt-0.5 block break-words text-sm font-medium text-slate-200">{valor}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
        className="flex items-start gap-3 rounded-2xl p-1 transition-colors hover:bg-white/[0.03]"
      >
        {contenido}
      </a>
    );
  }

  return <div className="flex items-start gap-3 p-1">{contenido}</div>;
}

export default function Landing({ onIngresar }) {
  const [empresa, setEmpresa] = useState(EMPRESA_BASE);
  const [sitio, setSitio] = useState(SITIO_BASE);
  const [proyectos, setProyectos] = useState([]);
  const [proyectoAbierto, setProyectoAbierto] = useState(null);
  const [fotoActiva, setFotoActiva] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState({
    nombre: '',
    telefono: '',
    tipo: SERVICIOS[0].titulo,
    mensaje: '',
  });

  useEffect(() => {
    let activo = true;

    (async () => {
      // Las vistas públicas solo exponen información segura y publicada.
      // Si la migración 003 o 004 aún no está aplicada, se usan los valores base.
      const [respuestaEmpresa, respuestaSitio, respuestaProyectos] = await Promise.all([
        supabase.from('empresa_publica').select('*').eq('id', 1).maybeSingle(),
        supabase.from('landing_publica').select('*').eq('id', 1).maybeSingle(),
        supabase
          .from('proyectos_publicos')
          .select('*')
          .order('destacado', { ascending: false })
          .order('orden', { ascending: true })
          .order('creado_en', { ascending: false }),
      ]);

      if (!activo) return;

      const datosEmpresa = respuestaEmpresa.data;
      if (datosEmpresa) {
        const normalizada = { ...EMPRESA_BASE };
        Object.keys(EMPRESA_BASE).forEach((campo) => {
          if (datosEmpresa[campo] !== null && datosEmpresa[campo] !== undefined && datosEmpresa[campo] !== '') {
            normalizada[campo] = datosEmpresa[campo];
          }
        });
        setEmpresa(normalizada);
      }

      const datosSitio = respuestaSitio.data;
      if (datosSitio) {
        const normalizado = { ...SITIO_BASE };
        Object.keys(SITIO_BASE).forEach((campo) => {
          const valor = datosSitio[campo];
          if (valor !== null && valor !== undefined && valor !== '') normalizado[campo] = valor;
        });
        normalizado.mostrar_proyectos = datosSitio.mostrar_proyectos !== false;
        normalizado.proyectos_limite = Number(datosSitio.proyectos_limite) || SITIO_BASE.proyectos_limite;
        setSitio(normalizado);
      }

      const lista = Array.isArray(respuestaProyectos.data) ? respuestaProyectos.data : [];
      setProyectos(
        lista.map((proyecto) => ({
          ...proyecto,
          imagenes: Array.isArray(proyecto.imagenes)
            ? proyecto.imagenes.filter(Boolean)
            : [],
        })),
      );
    })();

    return () => {
      activo = false;
    };
  }, []);

  const abrirProyecto = (proyecto) => {
    setProyectoAbierto(proyecto);
    setFotoActiva(0);
  };

  const beneficiosHero = String(sitio.hero_beneficios || '')
    .split(/[\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const proyectosVisibles = proyectos
    .filter((proyecto) => proyecto.publicado !== false)
    .slice(0, Number(sitio.proyectos_limite) || 6);

  const imagenesAbiertas = (proyectoAbierto?.imagenes || []).map(urlImagenProyecto);
  const imagenActiva = imagenesAbiertas[fotoActiva] || imagenesAbiertas[0] || null;

  const moverFoto = (delta) => {
    if (imagenesAbiertas.length < 2) return;
    setFotoActiva((actual) => (actual + delta + imagenesAbiertas.length) % imagenesAbiertas.length);
  };

  const telefonoVisible = empresa.celular || empresa.telefono || '';
  const digitos = telefonoVisible.replace(/\D/g, '');
  const numeroWa = digitos
    ? digitos.startsWith('57')
      ? digitos
      : `57${digitos}`
    : '';
  const urlWa = numeroWa ? `https://wa.me/${numeroWa}` : '';
  const enlaceTelefono = telefonoVisible ? `tel:${telefonoVisible.replace(/\s/g, '')}` : '';
  const enlaceCorreo = empresa.email ? `mailto:${empresa.email}` : '';

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    if (aviso) setAviso('');
  };

  const enviarSolicitud = (evento) => {
    evento.preventDefault();
    setAviso('');

    const resumen =
      `Hola ${empresa.nombre_comercial}, soy ${form.nombre.trim()}. ` +
      `Me interesa: ${form.tipo}. ` +
      `${form.mensaje.trim() ? `${form.mensaje.trim()} ` : ''}` +
      `Mi teléfono: ${form.telefono.trim()}.`;

    if (urlWa) {
      window.open(`${urlWa}?text=${encodeURIComponent(resumen)}`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (empresa.email) {
      window.location.href = `mailto:${empresa.email}?subject=${encodeURIComponent(
        `Solicitud de cotización · ${form.tipo}`,
      )}&body=${encodeURIComponent(resumen)}`;
      return;
    }

    setAviso(
      'Aún no hay un canal de contacto configurado. Agrega el celular o correo de la empresa en el módulo Empresa.',
    );
  };

  const anio = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navegación */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <Marca />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación del sitio">
            {ENLACES.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                {enlace.etiqueta}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#contacto"
              className="hidden items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-500 sm:inline-flex"
            >
              Cotizar <ArrowRight size={14} />
            </a>
            <button
              type="button"
              onClick={onIngresar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
            >
              <LogIn size={14} /> <span className="hidden sm:inline">Ingresar</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuAbierto((valor) => !valor)}
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuAbierto}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-300 lg:hidden"
            >
              {menuAbierto ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuAbierto && (
          <nav className="border-t border-white/5 bg-slate-950/95 px-5 py-4 lg:hidden" aria-label="Navegación móvil">
            <div className="space-y-1">
              {ENLACES.map((enlace) => (
                <a
                  key={enlace.href}
                  href={enlace.href}
                  onClick={() => setMenuAbierto(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {enlace.etiqueta}
                </a>
              ))}
              <a
                href="#contacto"
                onClick={() => setMenuAbierto(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
              >
                Solicitar cotización <ArrowRight size={15} />
              </a>
            </div>
          </nav>
        )}
      </header>

      <main id="inicio">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 -top-24 h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-3xl" />
            <div className="absolute -right-24 top-1/3 h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-3xl" />
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.05) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
                maskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
                WebkitMaskImage: 'radial-gradient(ellipse at center, black, transparent 75%)',
              }}
            />
          </div>

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-20">
            <div className="space-y-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  <MapPin size={12} />{' '}
                  {sitio.hero_etiqueta || `${empresa.ciudad}, ${empresa.departamento_geografico}`}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Taller con fabricación propia
                </span>
              </div>

              <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {sitio.hero_titulo}{' '}
                <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-white bg-clip-text text-transparent">
                  {sitio.hero_destacado}
                </span>
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                {sitio.hero_texto}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#contacto"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/25 transition-all hover:-translate-y-0.5 hover:bg-blue-500"
                >
                  Solicitar cotización <ArrowRight size={16} />
                </a>
                <a
                  href="#servicios"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Ver servicios <ChevronRight size={16} />
                </a>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                {beneficiosHero.map((texto) => (
                  <span key={texto} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-400" /> {texto}
                  </span>
                ))}
              </div>
            </div>

            <PlanoTecnico />
          </div>
        </section>

        {/* Beneficios */}
        <section className="border-y border-white/5 bg-white/[0.02]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-7 lg:grid-cols-4 lg:px-8">
            {BENEFICIOS.map(({ icono: Icono, titulo, detalle }) => (
              <div key={titulo} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-300">
                  <Icono size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">{titulo}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{detalle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Servicios */}
        <section id="servicios" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <Encabezado
            eyebrow="Nuestros servicios"
            titulo="Soluciones completas en aluminio y vidrio"
            texto="Un solo equipo para medir, fabricar e instalar. Trabajamos vivienda, comercio, oficinas y proyectos especiales."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map(({ icono: Icono, titulo, descripcion, items }) => (
              <article
                key={titulo}
                className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:bg-white/[0.05]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-gradient-to-br from-blue-500/20 to-cyan-400/10 text-sky-300">
                  <Icono size={22} />
                </span>
                <h3 className="mt-5 text-sm font-bold text-white">{titulo}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{descripcion}</p>
                <ul className="mt-4 space-y-2 border-t border-white/5 pt-4">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-[11px] text-slate-300">
                      <Check size={13} className="mt-0.5 shrink-0 text-sky-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* Soluciones */}
        <section id="soluciones" className="scroll-mt-20 border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
            <Encabezado
              eyebrow="Diseñado para cada espacio"
              titulo="La medida justa, el acabado correcto"
              texto="Cada proyecto empieza por entender cómo se usa el espacio. Después elegimos el sistema, el vidrio y los herrajes que mejor funcionan."
            />

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {SOLUCIONES.map((solucion) => (
                <TarjetaSolucion key={solucion.titulo} {...solucion} />
              ))}
            </div>
          </div>
        </section>

        {/* Proceso */}
        <section id="proceso" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <Encabezado
              eyebrow="Cómo trabajamos"
              titulo="Un proceso claro, de la medida a la entrega"
              texto="Sin sorpresas: sabes qué se va a fabricar, con qué materiales y en qué tiempos."
            />
            <a
              href="#contacto"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-sky-400 transition-colors hover:text-sky-300"
            >
              Empezar mi proyecto <ArrowUpRight size={15} />
            </a>
          </div>

          <div className="relative mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-[12%] right-[12%] top-8 hidden h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent lg:block" />
            {PROCESO.map(({ icono: Icono, titulo, texto }, indice) => (
              <div key={titulo} className="relative rounded-3xl border border-white/10 bg-slate-900/40 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Icono size={21} />
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {String(indice + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 text-sm font-bold text-white">{titulo}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Proyectos realizados */}
        {sitio.mostrar_proyectos && (
          <section id="proyectos" className="scroll-mt-20 border-y border-white/5 bg-white/[0.015]">
            <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
                <Encabezado
                  eyebrow="Portafolio"
                  titulo={sitio.proyectos_titulo}
                  texto={sitio.proyectos_texto}
                />
                {proyectosVisibles.length > 0 && (
                  <a
                    href="#contacto"
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-sky-400 transition-colors hover:text-sky-300"
                  >
                    Quiero un proyecto así <ArrowUpRight size={15} />
                  </a>
                )}
              </div>

              {proyectosVisibles.length === 0 ? (
                <div className="mt-10 rounded-3xl border border-dashed border-white/10 bg-slate-900/30 p-10 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Camera size={26} />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-white">
                    Estamos preparando nuestro portafolio
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
                    Muy pronto publicaremos aquí los trabajos realizados. Mientras tanto, escríbenos
                    y te mostramos proyectos similares al tuyo.
                  </p>
                  <a
                    href="#contacto"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                  >
                    Hablar con el taller <ArrowRight size={14} />
                  </a>
                </div>
              ) : (
                <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {proyectosVisibles.map((proyecto) => {
                    const portada = urlImagenProyecto(proyecto.imagenes?.[0]);

                    return (
                      <button
                        key={proyecto.id}
                        type="button"
                        onClick={() => abrirProyecto(proyecto)}
                        className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] text-left transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/30 hover:shadow-2xl hover:shadow-blue-950/40"
                      >
                        <div className="relative h-56 overflow-hidden bg-slate-900">
                          {portada ? (
                            <img
                              src={portada}
                              alt={proyecto.titulo}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-white/10">
                              <Frame size={110} strokeWidth={0.8} />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />

                          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/50 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-200 backdrop-blur">
                            {proyecto.categoria}
                          </span>

                          {proyecto.destacado && (
                            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/20 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-100 backdrop-blur">
                              <Star size={9} /> Destacado
                            </span>
                          )}

                          <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-slate-200">
                            {proyecto.ubicacion && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin size={11} className="text-sky-300" /> {proyecto.ubicacion}
                              </span>
                            )}
                            {proyecto.anio && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar size={11} className="text-sky-300" /> {proyecto.anio}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col p-5">
                          <h3 className="text-sm font-bold text-white transition-colors group-hover:text-sky-200">
                            {proyecto.titulo}
                          </h3>
                          {proyecto.descripcion && (
                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                              {proyecto.descripcion}
                            </p>
                          )}
                          {proyecto.materiales && (
                            <p className="mt-3 line-clamp-1 text-[10px] text-slate-500">
                              {proyecto.materiales}
                            </p>
                          )}
                          <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-4 text-[10px]">
                            <span className="inline-flex items-center gap-1.5 font-bold text-sky-300">
                              Ver proyecto <ArrowUpRight size={12} />
                            </span>
                            {proyecto.imagenes?.length > 1 && (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Images size={12} /> {proyecto.imagenes.length} fotos
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Nosotros */}
        <section id="nosotros" className="scroll-mt-20 border-y border-white/5 bg-white/[0.015]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-24">
            <div className="space-y-6">
              <Encabezado
                eyebrow="El taller"
                titulo={sitio.nosotros_titulo}
                texto={sitio.nosotros_texto}
              />

              <ul className="grid gap-3 sm:grid-cols-2">
                {COMPROMISOS.map((compromiso) => (
                  <li key={compromiso} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check size={10} />
                    </span>
                    {compromiso}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                  <MapPin size={12} className="text-sky-400" /> {empresa.ciudad},{' '}
                  {empresa.departamento_geografico}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
                  <Clock size={12} className="text-sky-400" /> {empresa.horario}
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-950/60 via-slate-900 to-slate-950 p-8 shadow-2xl">
                <Quote size={34} className="text-sky-400/60" />
                <p className="mt-4 text-lg font-semibold leading-relaxed text-slate-100">
                  “Un buen trabajo empieza con una buena medida. Por eso medimos, fabricamos y
                  revisamos cada pieza antes de llegar a tu espacio.”
                </p>
                <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-300 text-sm font-black text-slate-950">
                    Y
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">YiKev Stratos</p>
                    <p className="text-[10px] text-slate-400">
                      Taller de aluminio, vidrio, PVC y acrílico
                    </p>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 px-3.5 py-2.5 shadow-xl backdrop-blur sm:flex">
                <ShieldCheck size={18} className="text-emerald-400" />
                <div>
                  <p className="text-[10px] font-bold text-white">Trabajo garantizado</p>
                  <p className="text-[9px] text-slate-400">Ajuste y soporte posterior</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 lg:px-8 lg:py-24">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl">
            <div className="grid lg:grid-cols-2">
              <div className="space-y-8 p-7 sm:p-10 lg:p-12">
                <Encabezado
                  eyebrow="Hablemos de tu proyecto"
                  titulo={sitio.contacto_titulo}
                  texto={sitio.contacto_texto}
                />

                <div className="space-y-2">
                  {urlWa && (
                    <DatoContacto
                      icono={MessageCircle}
                      etiqueta="WhatsApp"
                      valor={telefonoVisible}
                      href={`${urlWa}?text=${encodeURIComponent(sitio.whatsapp_mensaje)}`}
                    />
                  )}
                  {empresa.telefono && empresa.telefono !== telefonoVisible && (
                    <DatoContacto
                      icono={Phone}
                      etiqueta="Teléfono"
                      valor={empresa.telefono}
                      href={enlaceTelefono}
                    />
                  )}
                  {empresa.email && (
                    <DatoContacto
                      icono={Mail}
                      etiqueta="Correo"
                      valor={empresa.email}
                      href={enlaceCorreo}
                    />
                  )}
                  {empresa.direccion && (
                    <DatoContacto
                      icono={MapPin}
                      etiqueta="Taller"
                      valor={`${empresa.direccion}, ${empresa.ciudad}`}
                    />
                  )}
                  <DatoContacto
                    icono={Clock}
                    etiqueta="Horario de atención"
                    valor={empresa.horario}
                  />
                </div>

                {!urlWa && !empresa.email && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-[11px] leading-relaxed text-amber-200/90">
                    Los canales de contacto están en configuración. Por ahora puedes visitarnos en{' '}
                    {empresa.ciudad}, {empresa.departamento_geografico}.
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-slate-950/50 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
                <form onSubmit={enviarSolicitud} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="sitio-nombre" className="mb-1.5 block text-xs font-semibold text-slate-300">
                        Nombre *
                      </label>
                      <input
                        id="sitio-nombre"
                        type="text"
                        required
                        value={form.nombre}
                        onChange={(evento) => actualizarCampo('nombre', evento.target.value)}
                        placeholder="Tu nombre"
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="sitio-telefono" className="mb-1.5 block text-xs font-semibold text-slate-300">
                        Teléfono *
                      </label>
                      <input
                        id="sitio-telefono"
                        type="tel"
                        required
                        value={form.telefono}
                        onChange={(evento) => actualizarCampo('telefono', evento.target.value)}
                        placeholder="311 000 0000"
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sitio-tipo" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Tipo de proyecto
                    </label>
                    <select
                      id="sitio-tipo"
                      value={form.tipo}
                      onChange={(evento) => actualizarCampo('tipo', evento.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      {SERVICIOS.map((servicio) => (
                        <option key={servicio.titulo} value={servicio.titulo}>
                          {servicio.titulo}
                        </option>
                      ))}
                      <option value="Otro proyecto">Otro proyecto</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="sitio-mensaje" className="mb-1.5 block text-xs font-semibold text-slate-300">
                      Cuéntanos un poco más
                    </label>
                    <textarea
                      id="sitio-mensaje"
                      rows={4}
                      value={form.mensaje}
                      onChange={(evento) => actualizarCampo('mensaje', evento.target.value)}
                      placeholder="Medidas aproximadas, ubicación, tipo de espacio..."
                      className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {aviso && (
                    <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">
                      {aviso}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/20 transition-colors hover:bg-blue-500"
                  >
                    <Send size={16} />
                    {urlWa ? 'Enviar por WhatsApp' : 'Solicitar información'}
                  </button>

                  <p className="text-center text-[10px] leading-relaxed text-slate-400">
                    Al enviar, se abrirá tu aplicación de mensajes con los datos listos para
                    enviar. No compartimos tu información con terceros.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div className="lg:col-span-2">
            <Marca />
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-400">
              Taller de aluminio, vidrio, PVC y acrílico en {empresa.ciudad},{' '}
              {empresa.departamento_geografico}. Diseñamos, fabricamos e instalamos soluciones a
              medida para vivienda, comercio y obra.
            </p>
            <button
              type="button"
              onClick={onIngresar}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[11px] font-semibold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
            >
              <LogIn size={13} /> Acceso al sistema
            </button>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Navegación
            </h3>
            <ul className="mt-4 space-y-2.5">
              {ENLACES.map((enlace) => (
                <li key={enlace.href}>
                  <a
                    href={enlace.href}
                    className="text-xs text-slate-400 transition-colors hover:text-white"
                  >
                    {enlace.etiqueta}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Contacto
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <MapPin size={13} className="mt-0.5 shrink-0 text-sky-400" />
                {empresa.direccion
                  ? `${empresa.direccion}, ${empresa.ciudad}`
                  : `${empresa.ciudad}, ${empresa.departamento_geografico}`}
              </li>
              {telefonoVisible && (
                <li className="flex items-start gap-2">
                  <Phone size={13} className="mt-0.5 shrink-0 text-sky-400" />
                  {telefonoVisible}
                </li>
              )}
              {empresa.email && (
                <li className="flex items-start gap-2">
                  <Mail size={13} className="mt-0.5 shrink-0 text-sky-400" />
                  {empresa.email}
                </li>
              )}
              <li className="flex items-start gap-2">
                <Clock size={13} className="mt-0.5 shrink-0 text-sky-400" />
                {empresa.horario}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-[10px] text-slate-400 sm:flex-row lg:px-8">
            <p>© {anio} {empresa.nombre_comercial}. Todos los derechos reservados.</p>
            <p>Aluminio · Vidrio · PVC · Acrílico · Quibdó, Chocó</p>
          </div>
        </div>
      </footer>

      {/* Asistente virtual: a la izquierda para no tapar el botón de WhatsApp */}
      <Chatbot
        modo="landing"
        posicion="izquierda"
        contexto={{
          empresa: empresa.nombre_comercial,
          ciudad: empresa.ciudad,
          departamento: empresa.departamento_geografico,
          telefono: empresa.celular || empresa.telefono || '',
        }}
      />

      {/* WhatsApp flotante */}
      {urlWa && (
        <a
          href={`${urlWa}?text=${encodeURIComponent(sitio.whatsapp_mensaje)}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Escribir por WhatsApp"
          className="fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30 transition-transform hover:scale-105"
          style={{ height: '3.25rem', width: '3.25rem' }}
        >
          <MessageCircle size={24} />
        </a>
      )}

      {/* Detalle del proyecto */}
      <Modal
        abierto={Boolean(proyectoAbierto)}
        titulo={proyectoAbierto?.titulo || 'Proyecto realizado'}
        subtitulo={
          proyectoAbierto
            ? [proyectoAbierto.categoria, proyectoAbierto.ubicacion]
                .filter(Boolean)
                .join(' · ')
            : ''
        }
        icono={<Images size={20} />}
        onClose={() => setProyectoAbierto(null)}
        ancho="max-w-4xl"
      >
        {proyectoAbierto && (
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              {imagenActiva ? (
                <img
                  src={imagenActiva}
                  alt={`${proyectoAbierto.titulo} — foto ${fotoActiva + 1}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-700">
                  <Camera size={54} />
                </div>
              )}

              {imagenesAbiertas.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => moverFoto(-1)}
                    aria-label="Foto anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white backdrop-blur transition-colors hover:bg-blue-600"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moverFoto(1)}
                    aria-label="Foto siguiente"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white backdrop-blur transition-colors hover:bg-blue-600"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold text-slate-200 backdrop-blur">
                    {fotoActiva + 1} / {imagenesAbiertas.length}
                  </span>
                </>
              )}
            </div>

            {imagenesAbiertas.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {imagenesAbiertas.map((url, indice) => (
                  <button
                    key={`${url}-${indice}`}
                    type="button"
                    onClick={() => setFotoActiva(indice)}
                    aria-label={`Ver foto ${indice + 1}`}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                      indice === fotoActiva
                        ? 'border-sky-400'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-4">
              {proyectoAbierto.descripcion && (
                <p className="text-xs leading-relaxed text-slate-300">
                  {proyectoAbierto.descripcion}
                </p>
              )}

              <dl className="grid gap-3 sm:grid-cols-2">
                {proyectoAbierto.cliente && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Cliente
                    </dt>
                    <dd className="mt-1 text-xs text-slate-200">{proyectoAbierto.cliente}</dd>
                  </div>
                )}
                {proyectoAbierto.ubicacion && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Ubicación
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-xs text-slate-200">
                      <MapPin size={12} className="text-sky-400" /> {proyectoAbierto.ubicacion}
                    </dd>
                  </div>
                )}
                {proyectoAbierto.anio && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Año de entrega
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 text-xs text-slate-200">
                      <Calendar size={12} className="text-sky-400" /> {proyectoAbierto.anio}
                    </dd>
                  </div>
                )}
                {proyectoAbierto.materiales && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                    <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      Materiales
                    </dt>
                    <dd className="mt-1 text-xs text-slate-200">{proyectoAbierto.materiales}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
