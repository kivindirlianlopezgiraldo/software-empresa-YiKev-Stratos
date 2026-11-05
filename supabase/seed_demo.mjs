// ============================================================================
// YiKev Stratos — Carga de datos de demostración
// ----------------------------------------------------------------------------
// Uso (PowerShell, desde la raíz del proyecto):
//
//   $env:ADMIN_DOCUMENTO="TU_DOCUMENTO"
//   $env:ADMIN_PASSWORD="TU_CONTRASENA_SEGURA"
//   node supabase/seed_demo.mjs
//
// Lee VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY del archivo .env.
// Es idempotente: no duplica materiales, sistemas ni órdenes.
// ============================================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_BASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const DOC = process.env.ADMIN_DOCUMENTO;
const PASS = process.env.ADMIN_PASSWORD;

if (!URL_BASE || !KEY) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env');
if (!DOC || !PASS) throw new Error('Define ADMIN_DOCUMENTO y ADMIN_PASSWORD en el entorno.');

const auth = async (path, body) => {
  const res = await fetch(`${URL_BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth ${res.status}: ${data.msg || data.error_description || JSON.stringify(data)}`);
  return data;
};

const sesion = await auth('token?grant_type=password', {
  email: `${DOC}@yikevstratos.local`,
  password: PASS,
});
const TOKEN = sesion.access_token;

const rest = async (path, { method = 'GET', body, prefer } = {}) => {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  const data = texto ? JSON.parse(texto) : null;
  if (!res.ok) throw new Error(`REST ${method} ${path} -> ${res.status}: ${texto}`);
  return data;
};

const insertar = (tabla, filas, { upsert = false, onConflict } = {}) =>
  rest(tabla, {
    method: 'POST',
    body: filas,
    prefer: `return=representation${upsert ? `,resolution=merge-duplicates` : ''}`,
  }).then((r) => {
    if (onConflict) return r;
    return r;
  });

const dias = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Perfiles (para asignar instalador)
// ---------------------------------------------------------------------------
const perfiles = await rest('perfiles_usuario?select=*');
const porDocumento = (doc) => {
  const p = perfiles.find((x) => x.documento_id === doc);
  if (!p) throw new Error(`No existe el perfil con documento ${doc}.`);
  return p;
};
const juan = porDocumento('1000000001');
const carlos = porDocumento('1000000002');
const pedro = perfiles.find((p) => p.documento_id === '1000000003') || juan;
const admin = perfiles.find((p) => p.documento_id === DOC) || carlos;

// ---------------------------------------------------------------------------
// 0) Datos de nómina de ejemplo (migración 003)
//    Solo completa campos vacíos: nunca sobrescribe información real.
// ---------------------------------------------------------------------------
const nominaDemo = {
  '1000000001': {
    departamento: 'Producción e Instalación',
    tipo_contrato: 'Indefinido',
    fecha_ingreso: '2023-02-15',
    salario: 1800000,
    telefono: '311 555 0011',
    ciudad: 'Quibdó',
    direccion: 'Barrio Pandeyuca, carrera 8 # 4-20',
    eps: 'Nueva EPS',
    arl: 'ARL Sura',
    contacto_emergencia_nombre: 'Ana Pérez (madre)',
    contacto_emergencia_telefono: '312 555 0011',
    talla_camisa: 'M',
    talla_pantalon: '32',
    talla_calzado: '41',
  },
  '1000000002': {
    departamento: 'Corte y Ensamble Aluminio',
    tipo_contrato: 'Indefinido',
    fecha_ingreso: '2021-08-01',
    salario: 2400000,
    telefono: '311 555 0022',
    ciudad: 'Quibdó',
    direccion: 'Barrio La Yesquita, calle 30 # 11-08',
    eps: 'Sanitas',
    arl: 'ARL Positiva',
    contacto_emergencia_nombre: 'Luz Rivas (esposa)',
    contacto_emergencia_telefono: '313 555 0022',
    talla_camisa: 'L',
    talla_pantalon: '34',
    talla_calzado: '42',
  },
  '1000000003': {
    departamento: 'Instalación en Obra',
    tipo_contrato: 'Obra o labor',
    fecha_ingreso: '2024-01-20',
    salario: 1600000,
    telefono: '311 555 0033',
    ciudad: 'Quibdó',
    direccion: 'Barrio Medrano, diagonal 12 # 9-14',
    eps: 'Nueva EPS',
    arl: 'ARL Sura',
    contacto_emergencia_nombre: 'María Mosquera (madre)',
    contacto_emergencia_telefono: '314 555 0033',
    talla_camisa: 'S',
    talla_pantalon: '30',
    talla_calzado: '40',
  },
};

let perfilesActualizados = 0;
try {
  // Si las columnas de la 003 no existen, PostgREST responde con error.
  await rest('perfiles_usuario?select=eps&limit=0');

  for (const [documento, datos] of Object.entries(nominaDemo)) {
    const fila = perfiles.find((p) => p.documento_id === documento);
    if (!fila) continue;

    const cambios = {};
    for (const [campo, valor] of Object.entries(datos)) {
      const actual = fila[campo];
      const vacio = actual === null || actual === undefined || actual === '' || actual === 0;
      if (vacio) cambios[campo] = valor;
    }

    if (Object.keys(cambios).length > 0) {
      await rest(`perfiles_usuario?id=eq.${fila.id}`, { method: 'PATCH', body: cambios });
      perfilesActualizados += 1;
    }
  }
} catch {
  console.warn(
    '\n⚠️  La migración 003 no está aplicada: se omiten los datos de nómina de ejemplo.\n' +
      '   Ejecuta supabase/migrations/003_admin_empresa.sql y vuelve a correr este script.\n',
  );
}

// ---------------------------------------------------------------------------
// 0.1) Datos públicos de la empresa (migración 003)
//      Solo inserta si la fila no existe: nunca sobrescribe datos reales.
// ---------------------------------------------------------------------------
let empresaConDatos = false;
try {
  const empresaDemo = {
    nombre_comercial: 'YiKev Stratos',
    razon_social: 'YiKev Stratos S.A.S.',
    nit: '900000000',
    digito_verificacion: '1',
    regimen_tributario: 'Responsable de IVA',
    actividad_economica: 'Fabricación e instalación de estructuras metálicas y vidrio',
    direccion: 'Carrera 1 # 25-30, Centro',
    ciudad: 'Quibdó',
    departamento_geografico: 'Chocó',
    telefono: '604 000 0000',
    celular: '311 555 0000',
    email: 'contacto@yikevstratos.com',
    sitio_web: 'www.yikevstratos.com',
    horario: 'Lunes a viernes 8:00 a.m. - 6:00 p.m. / Sábados 8:00 a.m. - 12:00 m.',
    representante_legal: 'Administrador',
    banco: 'Bancolombia',
    tipo_cuenta: 'Ahorros',
    numero_cuenta: '000-000000-00',
    titular_cuenta: 'YiKev Stratos S.A.S.',
    notas: 'Datos de demostración. Edítalos en el módulo Empresa.',
  };

  const filasEmpresa = await rest('empresa_config?select=*&id=eq.1');

  if (filasEmpresa.length === 0) {
    await rest('empresa_config', {
      method: 'POST',
      body: [{ id: 1, ...empresaDemo, actualizado_por: 'Seed de demostración' }],
    });
    empresaConDatos = true;
  } else {
    const actual = filasEmpresa[0];
    const cambios = {};
    for (const [campo, valor] of Object.entries(empresaDemo)) {
      const vacio = actual[campo] === null || actual[campo] === undefined || actual[campo] === '';
      if (vacio) cambios[campo] = valor;
    }

    if (Object.keys(cambios).length > 0) {
      await rest('empresa_config?id=eq.1', {
        method: 'PATCH',
        body: { ...cambios, actualizado_por: 'Seed de demostración' },
      });
      empresaConDatos = true;
    }
  }
} catch {
  console.warn(
    '\n⚠️  La migración 003 no está aplicada: se omite la configuración de empresa.\n' +
      '   Ejecuta supabase/migrations/003_admin_empresa.sql y vuelve a correr este script.\n',
  );
}

// ---------------------------------------------------------------------------
// 0.2) Portafolio y textos de la landing (migración 004)
//      Solo inserta proyectos que no existan por título. Nunca sobrescribe
//      proyectos reales ni textos que el administrador ya haya editado.
// ---------------------------------------------------------------------------
let proyectosCreados = 0;
let landingConDatos = false;

const proyectosDemo = [
  {
    titulo: 'Ventanería Hotel Camino Real',
    categoria: 'Aluminio',
    cliente: 'Hotel Camino Real',
    ubicacion: 'Quibdó, Chocó',
    anio: 2024,
    descripcion:
      'Ventanas corredizas y proyectantes para las habitaciones de la suite 402, con vidrio claro y mosquitero. Se reforzó el sellado para el clima húmedo de la región.',
    materiales: 'Aluminio línea 5020, vidrio claro 4 mm y mosquitero',
    imagenes: ['/proyectos/ventaneria-hotel.svg'],
    destacado: true,
    publicado: true,
    orden: 1,
  },
  {
    titulo: 'División de baño en vidrio templado',
    categoria: 'Vidrio templado',
    cliente: 'Hotel Camino Real',
    ubicacion: 'Quibdó, Chocó',
    anio: 2024,
    descripcion:
      'Panel fijo y puerta abatible en templado de 8 mm con bisagras hidráulicas y sellado sanitario. Acabados en acero inoxidable para un baño moderno y funcional.',
    materiales: 'Vidrio templado 8 mm, bisagras hidráulicas y sellante sanitario',
    imagenes: ['/proyectos/division-bano.svg'],
    destacado: true,
    publicado: true,
    orden: 2,
  },
  {
    titulo: 'Fachada flotante Fundación Chocó',
    categoria: 'Mixto',
    cliente: 'Fundación Chocó',
    ubicacion: 'Quibdó, Chocó',
    anio: 2023,
    descripcion:
      'Muro cortina de seis paños fijos para la sede administrativa. La estructura se instaló con andamio y se coordinó con el maestro de obra para dejar el acceso principal terminado.',
    materiales: 'Perfiles estructurales de aluminio y vidrio laminado',
    imagenes: ['/proyectos/fachada-oficina.svg'],
    destacado: false,
    publicado: true,
    orden: 3,
  },
  {
    titulo: 'Espejo panorámico Almacén La 14',
    categoria: 'Acrílico',
    cliente: 'Almacén La 14',
    ubicacion: 'Quibdó, Chocó',
    anio: 2023,
    descripcion:
      'Espejo de 1.80 × 0.90 m instalado sobre muro con adhesivo estructural y marco a medida. También se fabricó el letrero en acrílico iluminado del acceso.',
    materiales: 'Espejo 3 mm, acrílico de 3 mm y adhesivo estructural',
    imagenes: ['/proyectos/espejo-acrilico.svg'],
    destacado: false,
    publicado: true,
    orden: 4,
  },
];

try {
  // Si la tabla no existe, PostgREST devuelve error y se muestra la advertencia.
  await rest('proyectos?select=id,titulo&limit=0');

  const proyectosExistentes = await rest('proyectos?select=id,titulo');
  const titulosExistentes = new Set(proyectosExistentes.map((p) => p.titulo));
  const nuevosProyectos = proyectosDemo.filter((p) => !titulosExistentes.has(p.titulo));

  for (const proyecto of nuevosProyectos) {
    await insertar('proyectos', [
      {
        id: randomUUID(),
        ...proyecto,
        actualizado_por: 'Seed de demostración',
      },
    ]);
    proyectosCreados += 1;
  }

  const landingDemo = {
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
    contacto_titulo: 'Cuéntanos qué necesitas',
    contacto_texto:
      'Escríbenos con las medidas aproximadas, el tipo de trabajo y la ciudad. Te respondemos con los siguientes pasos.',
    whatsapp_mensaje: 'Hola, quiero cotizar un proyecto en aluminio y vidrio.',
  };

  const filasLanding = await rest('landing_config?select=*&id=eq.1');

  if (filasLanding.length === 0) {
    await rest('landing_config', {
      method: 'POST',
      body: [
        {
          id: 1,
          ...landingDemo,
          mostrar_proyectos: true,
          proyectos_limite: 6,
          actualizado_por: 'Seed de demostración',
        },
      ],
    });
    landingConDatos = true;
  } else {
    const actual = filasLanding[0];
    const cambios = {};
    for (const [campo, valor] of Object.entries(landingDemo)) {
      const vacio = actual[campo] === null || actual[campo] === undefined || actual[campo] === '';
      if (vacio) cambios[campo] = valor;
    }

    if (Object.keys(cambios).length > 0) {
      await rest('landing_config?id=eq.1', {
        method: 'PATCH',
        body: { ...cambios, actualizado_por: 'Seed de demostración' },
      });
      landingConDatos = true;
    }
  }
} catch {
  console.warn(
    '\n⚠️  La migración 004 no está aplicada: se omiten los proyectos y textos de la landing.\n' +
      '   Ejecuta supabase/migrations/004_proyectos_landing.sql y vuelve a correr este script.\n',
  );
}

// ---------------------------------------------------------------------------
// 1) Inventario
// ---------------------------------------------------------------------------
const materiales = [
  // Perfiles de Aluminio
  { codigo_referencia: 'ALU-5020-NAT', nombre: 'Perfil corredizo 5020 natural', categoria: 'Perfiles de Aluminio', unidad_medida: 'Barra (6m)', stock_actual: 40, stock_minimo: 10, precio_costo: 85000, precio_venta: 125000 },
  { codigo_referencia: 'ALU-3835-BLA', nombre: 'Perfil batiente 3835 blanco', categoria: 'Perfiles de Aluminio', unidad_medida: 'Barra (6m)', stock_actual: 25, stock_minimo: 8, precio_costo: 92000, precio_venta: 138000 },
  { codigo_referencia: 'ALU-TUB-12', nombre: 'Tubular 1" x 2" negro', categoria: 'Perfiles de Aluminio', unidad_medida: 'Barra (6m)', stock_actual: 18, stock_minimo: 6, precio_costo: 78000, precio_venta: 115000 },
  // Vidrio y Cristales
  { codigo_referencia: 'VID-4MM', nombre: 'Vidrio claro 4 mm', categoria: 'Vidrio y Cristales', unidad_medida: 'Metro cuadrado (m²)', stock_actual: 30, stock_minimo: 10, precio_costo: 38000, precio_venta: 55000 },
  { codigo_referencia: 'VID-TEMP-8', nombre: 'Vidrio templado 8 mm', categoria: 'Vidrio y Cristales', unidad_medida: 'Metro cuadrado (m²)', stock_actual: 12, stock_minimo: 4, precio_costo: 120000, precio_venta: 175000 },
  { codigo_referencia: 'VID-ESP-3', nombre: 'Espejo 3 mm', categoria: 'Vidrio y Cristales', unidad_medida: 'Metro cuadrado (m²)', stock_actual: 8, stock_minimo: 3, precio_costo: 42000, precio_venta: 65000 },
  // Acrílicos y PVC
  { codigo_referencia: 'ACR-3MM', nombre: 'Lámina acrílica 3 mm', categoria: 'Acrílicos y PVC', unidad_medida: 'Metro cuadrado (m²)', stock_actual: 10, stock_minimo: 3, precio_costo: 55000, precio_venta: 85000 },
  { codigo_referencia: 'PVC-2PUL', nombre: 'Perfil PVC blanco 2"', categoria: 'Acrílicos y PVC', unidad_medida: 'Barra (6m)', stock_actual: 15, stock_minimo: 5, precio_costo: 32000, precio_venta: 48000 },
  // Accesorios y Herrajes
  { codigo_referencia: 'HER-KIT-RUED', nombre: 'Kit de ruedas ventana corrediza', categoria: 'Accesorios y Herrajes', unidad_medida: 'Kit', stock_actual: 30, stock_minimo: 10, precio_costo: 18000, precio_venta: 28000 },
  { codigo_referencia: 'HER-CERR-VEN', nombre: 'Cerradura para ventana corrediza', categoria: 'Accesorios y Herrajes', unidad_medida: 'Unidad', stock_actual: 24, stock_minimo: 8, precio_costo: 15000, precio_venta: 24000 },
  { codigo_referencia: 'HER-BIS-HID', nombre: 'Bisagra hidráulica para vidrio', categoria: 'Accesorios y Herrajes', unidad_medida: 'Unidad', stock_actual: 12, stock_minimo: 4, precio_costo: 65000, precio_venta: 95000 },
  // Empaques y Sellantes
  { codigo_referencia: 'EMP-FELPA', nombre: 'Empaque felpa 6 mm', categoria: 'Empaques y Sellantes', unidad_medida: 'Rollos', stock_actual: 20, stock_minimo: 6, precio_costo: 12000, precio_venta: 19000 },
  { codigo_referencia: 'EMP-SIL-NEG', nombre: 'Silicona estructural negra', categoria: 'Empaques y Sellantes', unidad_medida: 'Unidad', stock_actual: 35, stock_minimo: 10, precio_costo: 22000, precio_venta: 32000 },
];

const existentes = await rest('inventario_materiales?select=id,codigo_referencia');
const yaEstan = new Set(existentes.map((m) => m.codigo_referencia));
const nuevosMateriales = materiales.filter((m) => !yaEstan.has(m.codigo_referencia));
if (nuevosMateriales.length) {
  await insertar('inventario_materiales', nuevosMateriales.map((m) => ({ id: randomUUID(), ...m })));
}
const inventario = await rest('inventario_materiales?select=id,codigo_referencia');
const materialPorCodigo = Object.fromEntries(inventario.map((m) => [m.codigo_referencia, m.id]));

// ---------------------------------------------------------------------------
// 2) Sistemas de trabajo + recetas
// ---------------------------------------------------------------------------
// Metadata de receta para que el despiece funcione desde el primer día.
// `perimetro` calcula 2·ancho + 2·alto; los descuentos van en milímetros.
const piezaPerfil = (formula = 'perimetro', descuento = 0, merma = 5) => ({
  tipo_pieza: 'perfil',
  formula_largo: formula,
  descuento_mm: descuento,
  merma_porcentaje: merma,
  es_vidrio: false,
});

const piezaVidrio = (descuento = 0, merma = 5) => ({
  tipo_pieza: 'vidrio',
  formula_largo: 'fijo',
  descuento_mm: descuento,
  merma_porcentaje: merma,
  es_vidrio: true,
});

const piezaAccesorio = (tipo = 'accesorio', merma = 0) => ({
  tipo_pieza: tipo,
  formula_largo: 'fijo',
  descuento_mm: 0,
  merma_porcentaje: merma,
  es_vidrio: false,
});

const sistemas = [
  {
    nombre: 'Ventana Corrediza 2 Hojas',
    linea: 'Línea 5025',
    descripcion: 'Ventana corrediza de dos hojas en aluminio 5025 con vidrio claro 4 mm.',
    tipo: 'corrediza',
    descuento_vidrio_ancho_mm: 30,
    descuento_vidrio_alto_mm: 30,
    merma_porcentaje: 5,
    receta: [
      ['ALU-5020-NAT', 1.5, piezaPerfil('ancho_mitad', 55)],
      ['VID-4MM', 1.2, piezaVidrio(0, 5)],
      ['HER-KIT-RUED', 1, piezaAccesorio('accesorio')],
      ['HER-CERR-VEN', 1, piezaAccesorio('accesorio')],
      ['EMP-FELPA', 0.5, piezaAccesorio('empaque')],
      ['EMP-SIL-NEG', 1, piezaAccesorio('empaque')],
    ],
  },
  {
    nombre: 'Puerta Batiente Aluminio 3835',
    linea: 'Línea 3835',
    descripcion: 'Puerta de una hoja con perfil 3835 blanco y vidrio templado 8 mm.',
    tipo: 'batiente',
    descuento_vidrio_ancho_mm: 40,
    descuento_vidrio_alto_mm: 30,
    merma_porcentaje: 5,
    receta: [
      ['ALU-3835-BLA', 2, piezaPerfil('perimetro', 30)],
      ['VID-TEMP-8', 1.8, piezaVidrio(0, 5)],
      ['HER-BIS-HID', 2, piezaAccesorio('accesorio')],
      ['EMP-SIL-NEG', 1, piezaAccesorio('empaque')],
    ],
  },
  {
    nombre: 'División de Baño en Vidrio Templado',
    linea: 'División de Baño',
    descripcion: 'Panel fijo más puerta abatible en templado 8 mm con bisagras hidráulicas.',
    tipo: 'division',
    descuento_vidrio_ancho_mm: 20,
    descuento_vidrio_alto_mm: 20,
    merma_porcentaje: 3,
    receta: [
      ['VID-TEMP-8', 3, piezaVidrio(0, 3)],
      ['HER-BIS-HID', 2, piezaAccesorio('accesorio')],
      ['EMP-SIL-NEG', 2, piezaAccesorio('empaque')],
    ],
  },
  {
    nombre: 'Ventanal Fijo con Tubular',
    linea: 'Línea Tubulares',
    descripcion: 'Ventanal fijo en tubular negro 1" x 2" con vidrio claro 4 mm.',
    tipo: 'fijo',
    descuento_vidrio_ancho_mm: 25,
    descuento_vidrio_alto_mm: 25,
    merma_porcentaje: 5,
    receta: [
      ['ALU-TUB-12', 2, piezaPerfil('perimetro', 20)],
      ['VID-4MM', 1.5, piezaVidrio(0, 5)],
      ['EMP-SIL-NEG', 1, piezaAccesorio('empaque')],
    ],
  },
  {
    nombre: 'Espejo Panorámico con Marco',
    linea: 'Acrílico Especial',
    descripcion: 'Espejo de 3 mm con marco en tubular y sellado estructural.',
    tipo: 'espejo',
    descuento_vidrio_ancho_mm: 15,
    descuento_vidrio_alto_mm: 15,
    merma_porcentaje: 2,
    receta: [
      ['VID-ESP-3', 1, piezaVidrio(0, 2)],
      ['ALU-TUB-12', 1.5, piezaPerfil('perimetro', 15)],
      ['EMP-SIL-NEG', 1, piezaAccesorio('empaque')],
    ],
  },
];

const sistemasExistentes = await rest('sistemas_trabajo?select=id,nombre');
const nombresSistemas = new Set(sistemasExistentes.map((s) => s.nombre));
const nuevosSistemas = sistemas.filter((s) => !nombresSistemas.has(s.nombre));

// La migración 005 agrega tipo y descuentos a los sistemas/recetas. Si aún no
// está aplicada, el seed sigue funcionando con el esquema base.
let esquemaProduccion = false;
try {
  await rest('sistema_materiales?select=tipo_pieza&limit=0');
  esquemaProduccion = true;
} catch {
  esquemaProduccion = false;
}

if (nuevosSistemas.length) {
  await insertar(
    'sistemas_trabajo',
    nuevosSistemas.map((s) => ({
      id: randomUUID(),
      nombre: s.nombre,
      linea: s.linea,
      descripcion: s.descripcion,
      ...(esquemaProduccion
        ? {
            tipo: s.tipo,
            descuento_vidrio_ancho_mm: s.descuento_vidrio_ancho_mm,
            descuento_vidrio_alto_mm: s.descuento_vidrio_alto_mm,
            merma_porcentaje: s.merma_porcentaje,
          }
        : {}),
    })),
  );
}

const listaSistemas = await rest('sistemas_trabajo?select=id,nombre');
const sistemaPorNombre = Object.fromEntries(listaSistemas.map((s) => [s.nombre, s.id]));

const recetasExistentes = await rest('sistema_materiales?select=sistema_id,material_id');
const claveReceta = (sistemaId, materialId) => `${sistemaId}|${materialId}`;
const yaEnReceta = new Set(recetasExistentes.map((r) => claveReceta(r.sistema_id, r.material_id)));

const nuevasRecetas = [];
for (const s of sistemas) {
  const sistemaId = sistemaPorNombre[s.nombre];
  s.receta.forEach(([codigo, cantidad, metadata = {}], indice) => {
    const materialId = materialPorCodigo[codigo];
    if (!materialId) return;
    if (yaEnReceta.has(claveReceta(sistemaId, materialId))) return;
    nuevasRecetas.push({
      id: randomUUID(),
      sistema_id: sistemaId,
      material_id: materialId,
      cantidad_requerida: cantidad,
      ...(esquemaProduccion ? { orden: indice, ...metadata } : {}),
    });
  });
}
if (nuevasRecetas.length) await insertar('sistema_materiales', nuevasRecetas);

// ---------------------------------------------------------------------------
// 3) Órdenes de trabajo
// ---------------------------------------------------------------------------

// La migración 002 agrega dirección, notas y fotos. Si no está aplicada,
// el seed se detiene con un mensaje claro en vez de fallar a medias.
try {
  await rest(
    'ordenes_trabajo?select=cliente_direccion,cliente_barrio,notas_medidas,imagenes_referencia,medido_en,medido_por&limit=0',
  );
} catch {
  console.error(
    '\n⚠️  Falta aplicar la migración 002.\n' +
      '   Abre el SQL Editor del proyecto y ejecuta:\n' +
      '   supabase/migrations/002_medidas_referencias.sql\n' +
      '   Luego vuelve a correr este script.\n',
  );
  process.exit(1);
}

const ordenes = [
  {
    codigo_orden: 'OT-DEMO-0001',
    cliente_nombre: 'Hotel Camino Real',
    cliente_telefono: '311 555 7723',
    cliente_direccion: 'Carrera 1 # 25-30',
    cliente_barrio: 'Centro',
    tipo_trabajo: 'División de Baño',
    medidas_terreno: '3 paneles de 1.20 x 2.00 m cada uno',
    notas_medidas: 'Confirmar con recepción antes de subir a las habitaciones. El baño es el de la suite 402.',
    medido_por: 'Pedro Mosquera',
    medido_en: dias(-1),
    estado: 'Pendiente de Asignación',
    prioridad: 'Alta',
    fecha_entrega: dias(6).slice(0, 10),
    creado_en: dias(-1),
  },
  {
    codigo_orden: 'OT-DEMO-0002',
    cliente_nombre: 'Colegio San Francisco',
    cliente_telefono: '314 555 3311',
    cliente_direccion: 'Calle 30 # 12-45',
    cliente_barrio: 'La Yesquita',
    tipo_trabajo: 'Ventana Proyectante',
    medidas_terreno: '1.50 x 1.50 m, 4 unidades',
    notas_medidas: 'El acceso es por la portería principal; avisar en vigilancia. Medir en horas de la tarde.',
    medido_por: 'Juan Pérez',
    medido_en: dias(-2),
    estado: 'Asignado a Instalador',
    prioridad: 'Normal',
    instalador_id: juan.id,
    instalador_nombre: juan.nombre_completo,
    fecha_entrega: dias(8).slice(0, 10),
    creado_en: dias(-2),
  },
  {
    codigo_orden: 'OT-DEMO-0003',
    cliente_nombre: 'Ferretería El Progreso',
    cliente_telefono: '320 555 8890',
    cliente_direccion: 'Carrera 5 # 18-12',
    cliente_barrio: 'Cristo Rey',
    tipo_trabajo: 'Puerta Vidrio Templado',
    medidas_terreno: '1.00 x 2.10 m, una hoja templada 8 mm',
    notas_medidas: 'Retirar la puerta vieja y dejar el marco limpio. El local abre de 8 a 6.',
    medido_por: 'Pedro Mosquera',
    medido_en: dias(-3),
    estado: 'Cotización Pendiente',
    prioridad: 'Normal',
    creado_en: dias(-3),
  },
  {
    codigo_orden: 'OT-DEMO-0004',
    cliente_nombre: 'María Rentería',
    cliente_telefono: '312 555 0142',
    cliente_direccion: 'Diagonal 12 # 8-24',
    cliente_barrio: 'Medrano',
    tipo_trabajo: 'Ventana Corrediza Línea 5020',
    medidas_terreno: '2.10 x 1.20 m, 2 hojas',
    notas_medidas: 'Tercer piso sin ascensor. La clienta pide instalación en la mañana.',
    medido_por: 'Pedro Mosquera',
    medido_en: dias(-5),
    estado: 'En Producción',
    prioridad: 'Alta',
    fecha_entrega: dias(4).slice(0, 10),
    creado_en: dias(-5),
  },
  {
    codigo_orden: 'OT-DEMO-0005',
    cliente_nombre: 'Almacén La 14',
    cliente_telefono: '310 555 2200',
    cliente_direccion: 'Calle 14 # 3-55',
    cliente_barrio: 'Pueblo Nuevo',
    tipo_trabajo: 'Espejo / Acrílico a medida',
    medidas_terreno: '1.80 x 0.90 m, espejo 3 mm con marco',
    notas_medidas: 'El espejo va pegado al muro; llevar silicona extra y tacos.',
    medido_por: 'Pedro Mosquera',
    medido_en: dias(-8),
    estado: 'Listo para Entrega / Finalizado',
    prioridad: 'Normal',
    instalador_id: carlos.id,
    instalador_nombre: carlos.nombre_completo,
    fecha_entrega: dias(1).slice(0, 10),
    creado_en: dias(-8),
  },
  {
    codigo_orden: 'OT-DEMO-0006',
    cliente_nombre: 'Fundación Chocó',
    cliente_telefono: '313 555 6644',
    cliente_direccion: 'Carrera 7 # 22-10',
    cliente_barrio: 'La Yesquita',
    tipo_trabajo: 'Fachada Flotante / Muro Cortina',
    medidas_terreno: '4.00 x 3.00 m, 6 paños fijos',
    notas_medidas: 'Hay andamio disponible en obra. Coordinar con el maestro de construcción.',
    medido_por: 'Carlos Rivas',
    medido_en: dias(-15),
    estado: 'Entregado',
    prioridad: 'Alta',
    instalador_id: carlos.id,
    instalador_nombre: carlos.nombre_completo,
    fecha_entrega: dias(-2).slice(0, 10),
    creado_en: dias(-15),
    entregado_en: dias(-2),
  },
];

const ordenesExistentes = await rest('ordenes_trabajo?select=id,codigo_orden,notas_medidas,medido_en');
const codigos = new Set(ordenesExistentes.map((o) => o.codigo_orden));
const nuevasOrdenes = ordenes.filter((o) => !codigos.has(o.codigo_orden));
if (nuevasOrdenes.length) {
  // PostgREST exige las mismas claves en todos los objetos de un insert masivo,
  // así que se insertan una por una.
  for (const orden of nuevasOrdenes) {
    await insertar('ordenes_trabajo', [{ id: randomUUID(), ...orden }]);
  }
}

// Completa dirección y notas en las órdenes demo que ya existían antes de la 002.
let actualizadas = 0;
for (const orden of ordenes) {
  const fila = ordenesExistentes.find((o) => o.codigo_orden === orden.codigo_orden);
  if (!fila) continue;

  const cambios = {
    cliente_direccion: orden.cliente_direccion,
    cliente_barrio: orden.cliente_barrio,
  };
  if (!fila.notas_medidas && orden.notas_medidas) cambios.notas_medidas = orden.notas_medidas;
  if (!fila.medido_en && orden.medido_en) {
    cambios.medido_en = orden.medido_en;
    cambios.medido_por = orden.medido_por;
  }

  await rest(`ordenes_trabajo?id=eq.${fila.id}`, { method: 'PATCH', body: cambios });
  actualizadas += 1;
}

// ---------------------------------------------------------------------------
// 4) Producción ampliada: ítems, vidrios, notificaciones, herramientas,
//    checklists e inventario de producción (migración 005).
//    Solo inserta lo que falta; nunca sobrescribe datos reales.
// ---------------------------------------------------------------------------
const demoProduccion = {
  items: 0,
  vidrios: 0,
  notificaciones: 0,
  herramientas: 0,
  inventario: 0,
  registros: 0,
};

try {
  await rest('orden_items?select=id&limit=0');

  const ordenesCreadas = await rest('ordenes_trabajo?select=id,codigo_orden');
  const ordenPorCodigo = Object.fromEntries(
    ordenesCreadas.map((o) => [o.codigo_orden, o.id]),
  );

  // 4.1) Varios proyectos/ventanas dentro de una misma orden.
  const itemsDemo = [
    {
      codigo: 'OT-DEMO-0001',
      descripcion: 'Panel fijo para baño suite 402',
      sistema: 'División de Baño en Vidrio Templado',
      tipo_trabajo: 'División de Baño',
      ancho_cm: 120,
      alto_cm: 200,
      cantidad: 2,
      vidrio_tipo: 'Vidrio templado claro',
      vidrio_espesor: '8 mm',
      color: 'Sin definir',
      observaciones: 'Incluye sellado sanitario y bisagras hidráulicas.',
    },
    {
      codigo: 'OT-DEMO-0001',
      descripcion: 'Puerta abatible para baño suite 402',
      sistema: 'División de Baño en Vidrio Templado',
      tipo_trabajo: 'División de Baño',
      ancho_cm: 80,
      alto_cm: 200,
      cantidad: 1,
      vidrio_tipo: 'Vidrio templado claro',
      vidrio_espesor: '8 mm',
      color: 'Sin definir',
      observaciones: 'Manija en acero inoxidable.',
    },
    {
      codigo: 'OT-DEMO-0002',
      descripcion: 'Ventanas proyectantes aulas 3 y 4',
      sistema: 'Ventana Corrediza 2 Hojas',
      tipo_trabajo: 'Ventana Proyectante',
      ancho_cm: 150,
      alto_cm: 150,
      cantidad: 4,
      vidrio_tipo: 'Vidrio claro',
      vidrio_espesor: '4 mm',
      color: 'Blanco',
      observaciones: 'Con mosquitero y cerradura de seguridad.',
    },
    {
      codigo: 'OT-DEMO-0003',
      descripcion: 'Puerta de acceso en vidrio templado',
      sistema: 'Puerta Batiente Aluminio 3835',
      tipo_trabajo: 'Puerta Vidrio Templado',
      ancho_cm: 100,
      alto_cm: 210,
      cantidad: 1,
      vidrio_tipo: 'Vidrio templado claro',
      vidrio_espesor: '8 mm',
      color: 'Negro',
      observaciones: 'Retirar la puerta existente y reutilizar el marco si está en buen estado.',
    },
    {
      codigo: 'OT-DEMO-0004',
      descripcion: 'Ventana corrediza habitación principal',
      sistema: 'Ventana Corrediza 2 Hojas',
      tipo_trabajo: 'Ventana Corrediza Línea 5020',
      ancho_cm: 210,
      alto_cm: 120,
      cantidad: 2,
      vidrio_tipo: 'Vidrio claro',
      vidrio_espesor: '4 mm',
      color: 'Blanco',
      observaciones: 'Tercer piso sin ascensor. Llevar ventosas.',
    },
    {
      codigo: 'OT-DEMO-0005',
      descripcion: 'Espejo panorámico con marco',
      sistema: 'Espejo Panorámico con Marco',
      tipo_trabajo: 'Espejo / Acrílico a medida',
      ancho_cm: 180,
      alto_cm: 90,
      cantidad: 1,
      vidrio_tipo: 'Espejo',
      vidrio_espesor: '3 mm',
      color: 'Natural',
      observaciones: 'Instalación sobre muro con adhesivo estructural.',
    },
    {
      codigo: 'OT-DEMO-0006',
      descripcion: 'Muro cortina sede administrativa',
      sistema: 'Ventanal Fijo con Tubular',
      tipo_trabajo: 'Fachada Flotante / Muro Cortina',
      ancho_cm: 400,
      alto_cm: 300,
      cantidad: 6,
      vidrio_tipo: 'Vidrio laminado',
      vidrio_espesor: '6 mm',
      color: 'Negro',
      observaciones: 'Seis paños fijos. Coordinar con el andamio de obra.',
    },
  ];

  const itemsExistentes = await rest('orden_items?select=orden_id');
  const ordenesConItems = new Set(itemsExistentes.map((fila) => fila.orden_id));

  for (const item of itemsDemo) {
    const ordenId = ordenPorCodigo[item.codigo];
    if (!ordenId || ordenesConItems.has(ordenId)) continue;

    await insertar('orden_items', [
      {
        id: randomUUID(),
        orden_id: ordenId,
        sistema_id: sistemaPorNombre[item.sistema] || null,
        sistema_nombre: item.sistema,
        descripcion: item.descripcion,
        tipo_trabajo: item.tipo_trabajo,
        ancho_cm: item.ancho_cm,
        alto_cm: item.alto_cm,
        cantidad: item.cantidad,
        vidrio_tipo: item.vidrio_tipo,
        vidrio_espesor: item.vidrio_espesor,
        color: item.color,
        observaciones: item.observaciones,
      },
    ]);
    demoProduccion.items += 1;
  }

  // 4.2) Medidas de vidrio enviadas por producción al jefe de taller.
  const ordenProduccion = ordenPorCodigo['OT-DEMO-0004'];
  const vidriosExistentes = await rest('orden_vidrios?select=orden_id');
  const ordenesConVidrios = new Set(vidriosExistentes.map((fila) => fila.orden_id));

  if (ordenProduccion && !ordenesConVidrios.has(ordenProduccion)) {
    const vidriosDemo = [
      { descripcion: 'Vidrio hoja izquierda', ancho_cm: 103, alto_cm: 113, cantidad: 1 },
      { descripcion: 'Vidrio hoja derecha', ancho_cm: 103, alto_cm: 113, cantidad: 1 },
    ];

    for (const vidrio of vidriosDemo) {
      await insertar('orden_vidrios', [
        {
          id: randomUUID(),
          orden_id: ordenProduccion,
          descripcion: vidrio.descripcion,
          ancho_cm: vidrio.ancho_cm,
          alto_cm: vidrio.alto_cm,
          cantidad: vidrio.cantidad,
          espesor: '4 mm',
          tipo: 'Vidrio claro',
          observaciones: 'Medida tomada en taller con descuento de 30 mm por lado.',
          enviado_por: juan.id,
          enviado_por_nombre: juan.nombre_completo,
        },
      ]);
      demoProduccion.vidrios += 1;
    }
  }

  // 4.3) Notificaciones internas de ejemplo.
  const notificacionesDemo = [
    {
      usuarioId: juan.id,
      ordenId: ordenProduccion,
      tipo: 'produccion',
      titulo: 'Nuevo trabajo en producción',
      mensaje: 'La orden OT-DEMO-0004 está aceptada. Revisa el despiece y confirma medidas de vidrio.',
    },
    {
      usuarioId: carlos.id,
      ordenId: ordenProduccion,
      tipo: 'medida',
      titulo: 'Medidas de vidrio pendientes',
      mensaje: 'Producción envió las medidas de la orden OT-DEMO-0004 para validación del jefe de taller.',
    },
    {
      usuarioId: juan.id,
      ordenId: ordenPorCodigo['OT-DEMO-0002'],
      tipo: 'orden',
      titulo: 'Trabajo asignado para instalación',
      mensaje: 'Tienes la orden OT-DEMO-0002 asignada. Confirma la visita y lleva el checklist de salida.',
    },
  ];

  const notificacionesExistentes = await rest('notificaciones?select=titulo');
  const titulosNotificacion = new Set(notificacionesExistentes.map((fila) => fila.titulo));

  for (const notificacion of notificacionesDemo) {
    if (titulosNotificacion.has(notificacion.titulo)) continue;
    await insertar('notificaciones', [
      {
        id: randomUUID(),
        usuario_id: notificacion.usuarioId,
        orden_id: notificacion.ordenId || null,
        tipo: notificacion.tipo,
        titulo: notificacion.titulo,
        mensaje: notificacion.mensaje,
        leida: false,
      },
    ]);
    demoProduccion.notificaciones += 1;
  }

  // 4.4) Catálogo de herramientas y asignación a colaboradores.
  const herramientasDemo = [
    {
      codigo: 'HER-TAL-01',
      nombre: 'Taladro percutor Bosch 13 mm',
      categoria: 'Herramienta eléctrica',
      descripcion: 'Taladro con maletín, brocas y batería de repuesto.',
      estado: 'Asignada',
      colaborador: juan,
      notas: 'Revisar cable y mandril antes de cada salida.',
    },
    {
      codigo: 'HER-AMO-01',
      nombre: 'Amoladora angular 4 1/2"',
      categoria: 'Herramienta eléctrica',
      descripcion: 'Amoladora con disco de corte y guarda de seguridad.',
      estado: 'Asignada',
      colaborador: juan,
      notas: 'Uso obligatorio de gafas y guantes.',
    },
    {
      codigo: 'HER-NIV-01',
      nombre: 'Nivel láser autonivelante',
      categoria: 'Herramienta de medición',
      descripcion: 'Nivel láser con trípode y estuche.',
      estado: 'Asignada',
      colaborador: pedro,
      notas: 'Calibrar si se detecta desviación en obra.',
    },
    {
      codigo: 'HER-ESC-01',
      nombre: 'Escalera telescópica 4 m',
      categoria: 'Equipo de seguridad',
      descripcion: 'Escalera de aluminio con bloqueo de seguridad.',
      estado: 'Disponible',
      colaborador: null,
      notas: 'Verificar peldaños y seguros antes de usar.',
    },
    {
      codigo: 'HER-LLV-01',
      nombre: 'Juego de llaves y destornilladores',
      categoria: 'Herramienta de mano',
      descripcion: 'Maletín completo para ajustes e instalación.',
      estado: 'Asignada',
      colaborador: pedro,
      notas: 'Reportar piezas faltantes al devolver.',
    },
  ];

  const herramientasExistentes = await rest('herramientas?select=id,codigo');
  const codigosHerramienta = new Set(
    herramientasExistentes.map((fila) => fila.codigo).filter(Boolean),
  );

  for (const herramienta of herramientasDemo) {
    if (herramienta.codigo && codigosHerramienta.has(herramienta.codigo)) continue;
    await insertar('herramientas', [
      {
        id: randomUUID(),
        codigo: herramienta.codigo,
        nombre: herramienta.nombre,
        categoria: herramienta.categoria,
        descripcion: herramienta.descripcion,
        estado: herramienta.estado,
        colaborador_id: herramienta.colaborador?.id || null,
        colaborador_nombre: herramienta.colaborador?.nombre_completo || null,
        asignado_por: herramienta.colaborador ? carlos.id : null,
        asignado_por_nombre: herramienta.colaborador ? carlos.nombre_completo : null,
        asignado_en: herramienta.colaborador ? dias(-3) : null,
        notas: herramienta.notas,
      },
    ]);
    demoProduccion.herramientas += 1;
  }

  // 4.5) Inventario propio del taller por colaborador.
  const inventarioDemo = [
    {
      nombre: 'Silicona neutra transparente',
      categoria: 'Empaques y sellantes',
      unidad_medida: 'Unidad',
      stock_actual: 18,
      stock_minimo: 6,
      ubicacion: 'Estante A2',
      notas: 'Marca Sika o equivalente.',
    },
    {
      nombre: 'Felpa para ventana corrediza',
      categoria: 'Consumibles de taller',
      unidad_medida: 'Rollos',
      stock_actual: 5,
      stock_minimo: 2,
      ubicacion: 'Estante A3',
      notas: 'Se usa en el sellado de hojas corredizas.',
    },
    {
      nombre: 'Broca para vidrio 6 mm',
      categoria: 'Herramienta menor',
      unidad_medida: 'Unidad',
      stock_actual: 2,
      stock_minimo: 3,
      ubicacion: 'Cajón de perforación',
      notas: 'Reponer: el stock está por debajo del mínimo.',
    },
    {
      nombre: 'Guantes anticorte',
      categoria: 'Seguridad industrial',
      unidad_medida: 'Par',
      stock_actual: 12,
      stock_minimo: 4,
      ubicacion: 'Casilleros de seguridad',
      notas: 'Talla L para el equipo de corte.',
    },
    {
      nombre: 'Remates de aluminio negro',
      categoria: 'Accesorios de ensamble',
      unidad_medida: 'Unidad',
      stock_actual: 24,
      stock_minimo: 8,
      ubicacion: 'Bodega de perfiles',
      notas: 'Sobrantes de la fachada de la Fundación Chocó.',
    },
  ];

  const inventarioExistente = await rest('inventario_produccion?select=id,nombre');
  const nombresInventario = new Set(inventarioExistente.map((fila) => fila.nombre));

  for (const insumo of inventarioDemo) {
    if (nombresInventario.has(insumo.nombre)) continue;
    await insertar('inventario_produccion', [
      {
        id: randomUUID(),
        nombre: insumo.nombre,
        categoria: insumo.categoria,
        unidad_medida: insumo.unidad_medida,
        stock_actual: insumo.stock_actual,
        stock_minimo: insumo.stock_minimo,
        ubicacion: insumo.ubicacion,
        colaborador_id: juan.id,
        colaborador_nombre: juan.nombre_completo,
        notas: insumo.notas,
        creado_por: juan.id,
        creado_por_nombre: juan.nombre_completo,
      },
    ]);
    demoProduccion.inventario += 1;
  }

  // 4.6) Plantillas de checklist (la migración 005 ya las crea; esto cubre
  //      instalaciones donde la migración se aplicó sin la sección 11).
  const plantillasDemo = [
    {
      nombre: 'Salida a instalación',
      tipo: 'salida',
      items: [
        'Taladro y baterías cargadas',
        'Nivel, escuadra y cinta métrica',
        'Herramientas de mano completas',
        'Silicona, empaques y consumibles',
        'Elementos de seguridad (guantes, gafas)',
        'Orden de trabajo y dirección del cliente',
      ],
    },
    {
      nombre: 'Entrada al taller',
      tipo: 'entrada',
      items: [
        'Todas las herramientas fueron devueltas',
        'Herramientas limpias y en buen estado',
        'Se reportaron daños o pérdidas',
        'Consumibles sobrantes entregados',
        'Área de trabajo organizada',
        'Novedades del trabajo reportadas',
      ],
    },
  ];

  const plantillasExistentes = await rest('herramienta_checklists?select=id,nombre,tipo,items');
  const nombresPlantilla = new Set(plantillasExistentes.map((fila) => fila.nombre));

  for (const plantilla of plantillasDemo) {
    if (nombresPlantilla.has(plantilla.nombre)) continue;
    await insertar('herramienta_checklists', [
      { id: randomUUID(), ...plantilla, activo: true },
    ]);
    nombresPlantilla.add(plantilla.nombre);
  }

  const plantillasActuales = await rest(
    'herramienta_checklists?select=id,nombre,tipo,items',
  );
  const plantillaSalida = plantillasActuales.find((fila) => fila.tipo === 'salida');

  if (plantillaSalida) {
    const registrosExistentes = await rest(
      `herramienta_registros?select=id,checklist_nombre,colaborador_id&colaborador_id=eq.${juan.id}`,
    );

    const yaFirmado = registrosExistentes.some(
      (fila) => fila.checklist_nombre === plantillaSalida.nombre,
    );

    if (!yaFirmado) {
      await insertar('herramienta_registros', [
        {
          id: randomUUID(),
          colaborador_id: juan.id,
          colaborador_nombre: juan.nombre_completo,
          orden_id: ordenPorCodigo['OT-DEMO-0004'] || null,
          checklist_id: plantillaSalida.id,
          checklist_nombre: plantillaSalida.nombre,
          tipo: 'salida',
          items: (plantillaSalida.items || []).map((texto) => ({
            texto: typeof texto === 'string' ? texto : texto?.texto || '',
            marcado: true,
          })),
          novedad: 'Salida completa. Se reporta una broca desgastada para reposición.',
        },
      ]);
      demoProduccion.registros += 1;
    }
  }

  // 4.7) Marca la orden demo en producción con su responsable.
  if (ordenProduccion) {
    const filasOrden = await rest(
      `ordenes_trabajo?select=id,produccion_id,notas_produccion&id=eq.${ordenProduccion}`,
    );
    const fila = filasOrden[0];
    if (fila && !fila.produccion_id) {
      await rest(`ordenes_trabajo?id=eq.${ordenProduccion}`, {
        method: 'PATCH',
        body: {
          origen: 'produccion',
          produccion_id: juan.id,
          produccion_nombre: juan.nombre_completo,
          aceptada_en: dias(-1),
          notas_produccion:
            fila.notas_produccion ||
            'Corte y ensamble asignados a Juan Pérez. Medidas de vidrio enviadas al jefe de taller.',
        },
      });
    }
  }
} catch (err) {
  console.warn(
    '\n⚠️  La migración 005 no está aplicada o faltan permisos: se omiten los datos demo de ' +
      'producción, herramientas y notificaciones.\n' +
      '   Ejecuta supabase/migrations/005_produccion_herramientas_ia.sql y vuelve a correr este script.\n' +
      `   Detalle: ${err?.message || err}\n`,
  );
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
const totales = await Promise.all([
  rest('inventario_materiales?select=id'),
  rest('sistemas_trabajo?select=id'),
  rest('sistema_materiales?select=id'),
  rest('ordenes_trabajo?select=id'),
]);
console.log('Materiales      :', totales[0].length);
console.log('Sistemas        :', totales[1].length);
console.log('Recetas         :', totales[2].length);
console.log('Órdenes         :', totales[3].length);
console.log('Insertados ahora:', {
  materiales: nuevosMateriales.length,
  sistemas: nuevosSistemas.length,
  recetas: nuevasRecetas.length,
  ordenes: nuevasOrdenes.length,
  ordenesConDireccion: actualizadas,
  perfilesConNomina: perfilesActualizados,
  empresaConDatos,
  proyectosCreados,
  landingConDatos,
  ...demoProduccion,
});
