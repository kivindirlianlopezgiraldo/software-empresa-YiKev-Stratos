// Catálogos y estados compartidos por toda la aplicación.
// Una sola fuente de verdad evita los desajustes que había entre
// Dashboard, Órdenes y los desplegables de los formularios.

export const DOMINIO_INTERNO = 'yikevstratos.local';

export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  JEFE_TALLER: 'Jefe de Taller',
  PRODUCCION: 'Producción',
  INSTALADOR: 'Instalador',
  VIDRIERO: 'Vidriero',
  BODEGUERO: 'Bodeguero',
};

export const ROLES_LIST = Object.values(ROLES);

export const DEPARTAMENTOS = [
  'Producción e Instalación',
  'Corte y Ensamble Aluminio',
  'Vidrio y Templados',
  'Instalación en Obra',
  'Almacén y Bodega',
  'Administración',
];

export const TIPOS_CONTRATO = [
  'Indefinido',
  'Término fijo',
  'Obra o labor',
  'Prestación de servicios',
  'Aprendiz',
];

export const TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const TALLAS_CALZADO = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];

export const REGIMENES_TRIBUTARIOS = [
  'Responsable de IVA',
  'No responsable de IVA',
  'Régimen simple de tributación',
  'Persona natural',
  'Entidad sin ánimo de lucro',
];

export const TIPOS_CUENTA = ['Ahorros', 'Corriente'];

export const CATEGORIAS_INVENTARIO = [
  'Perfiles de Aluminio',
  'Vidrio y Cristales',
  'Acrílicos y PVC',
  'Accesorios y Herrajes',
  'Empaques y Sellantes',
];

export const UNIDADES_MEDIDA = [
  'Barra (6m)',
  'Metro lineal (m)',
  'Metro cuadrado (m²)',
  'Unidad',
  'Par',
  'Caja',
  'Rollos',
  'Kit',
];

export const LINEAS_SISTEMA = [
  'Línea 50/20',
  'Línea 3835',
  'Línea 5025',
  'Línea Tubulares',
  'División de Baño',
  'Sistema PVC',
  'Acrílico Especial',
];

export const TIPOS_TRABAJO = [
  'Ventana Proyectante',
  'Ventana Corrediza Línea 5020',
  'Puerta Vidrio Templado',
  'Fachada Flotante / Muro Cortina',
  'División de Baño',
  'Espejo / Acrílico a medida',
];

export const CATEGORIAS_PROYECTO = [
  'Aluminio',
  'Vidrio templado',
  'PVC',
  'Acrílico',
  'Mixto',
];

export const TIPOS_VIDRIO = [
  'Vidrio claro',
  'Vidrio bronce',
  'Vidrio gris',
  'Vidrio templado claro',
  'Vidrio templado bronce',
  'Vidrio laminado',
  'Vidrio esmerilado',
  'Espejo',
  'Acrílico',
  'Sin vidrio',
];

export const ESPESORES_VIDRIO = ['3 mm', '4 mm', '5 mm', '6 mm', '8 mm', '10 mm', '12 mm'];

export const COLORES_PERFIL = [
  'Blanco',
  'Negro',
  'Natural',
  'Bronce',
  'Gris',
  'Madera',
  'Champagne',
  'Sin definir',
];

// Flujo real de una orden. Los textos deben coincidir EXACTAMENTE
// con lo que se guarda en la columna `estado`.
export const ESTADOS = {
  PENDIENTE_ASIGNACION: 'Pendiente de Asignación',
  ASIGNADO_INSTALADOR: 'Asignado a Instalador',
  COTIZACION_PENDIENTE: 'Cotización Pendiente',
  PENDIENTE_PRODUCCION: 'Pendiente de Producción',
  EN_PRODUCCION: 'En Producción',
  FINALIZADO: 'Listo para Entrega / Finalizado',
  ENTREGADO: 'Entregado',
};

export const ESTADOS_LIST = Object.values(ESTADOS);

// Clases Tailwind por estado (una sola definición, usada en tabla y filtros)
export const ESTADO_ESTILO = {
  [ESTADOS.PENDIENTE_ASIGNACION]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  [ESTADOS.ASIGNADO_INSTALADOR]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [ESTADOS.COTIZACION_PENDIENTE]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  [ESTADOS.PENDIENTE_PRODUCCION]: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  [ESTADOS.EN_PRODUCCION]: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  [ESTADOS.FINALIZADO]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  [ESTADOS.ENTREGADO]: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};

// Tipos de pieza que se pueden configurar en la receta de un sistema.
export const TIPOS_PIEZA = [
  { valor: 'perfil', etiqueta: 'Perfil / corte de aluminio' },
  { valor: 'vidrio', etiqueta: 'Vidrio / espejo' },
  { valor: 'accesorio', etiqueta: 'Accesorio / herraje' },
  { valor: 'empaque', etiqueta: 'Empaque / sellante' },
];

// Cómo se calcula el largo de corte de una pieza a partir del vano.
// Las fórmulas avanzadas de una línea se guardan en `formula_config`:
//   { base, restarCm, dividir, referencia, angulo }
// Ejemplos:
//   jamba 50/20     -> { base: 'alto',  restarCm: 1.3, angulo: 5 }
//   horizontal      -> { base: 'ancho', restarCm: 2.8, dividir: 4 }
//   barra toallera  -> { base: 'referencia', referencia: 'PV17 ancho', restarCm: 9 }
export const FORMULAS_CORTE = [
  { valor: 'fijo', etiqueta: 'Cantidad fija (sin corte)' },
  { valor: 'ancho', etiqueta: 'Ancho del vano' },
  { valor: 'alto', etiqueta: 'Alto del vano' },
  { valor: 'ancho_mitad', etiqueta: 'Ancho ÷ 2 (una hoja)' },
  { valor: 'alto_mitad', etiqueta: 'Alto ÷ 2' },
  { valor: 'perimetro', etiqueta: 'Perímetro (2 ancho + 2 alto)' },
  { valor: 'referencia', etiqueta: 'Medida de otra pieza (referencia)' },
];

// Colores que se pueden usar para identificar un retal en producción.
export const COLORES_RETAL = [...COLORES_PERFIL, 'Sin definir'];

export const TIPOS_SISTEMA = [
  'corrediza',
  'batiente',
  'fijo',
  'division',
  'espejo',
  'pvc',
  'acrilico',
  'proyecto_especial',
];

export const ESTADOS_HERRAMIENTA = [
  'Disponible',
  'Asignada',
  'En uso',
  'Mantenimiento',
  'Perdida',
  'Dañada',
];

export const CATEGORIAS_HERRAMIENTA = [
  'Herramienta de corte',
  'Herramienta de medición',
  'Herramienta eléctrica',
  'Herramienta de mano',
  'Equipo de seguridad',
  'Insumo / consumible',
];

export const CATEGORIAS_INVENTARIO_PRODUCCION = [
  'Insumos de producción',
  'Consumibles de taller',
  'Empaques y sellantes',
  'Accesorios de ensamble',
  'Vidrio y retales',
  'Herramienta menor',
  'Seguridad industrial',
];

// Normaliza tildes y mayúsculas: "Producción" -> "produccion".
// Sin esto, los roles con tilde no coincidían con los permisos esperados.
const normalizar = (rol) =>
  (rol || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

// Permisos derivados del organigrama del taller.
export function permisosDe(rol) {
  const r = normalizar(rol);
  const esAdmin = r.includes('admin') || r.includes('gerencia') || r.includes('super');
  const esJefe = r.includes('jefe');
  const esProduccion = r.includes('produccion') || r.includes('taller') || r.includes('vidriero');
  const esInstalador = r.includes('instalador');
  const esBodega = r.includes('bodega') || r.includes('almacen');

  return {
    rol,
    esAdmin,
    esJefe,
    esProduccion,
    esInstalador,
    esBodega,
    // Gestión de personal, salarios y borrado de registros
    puedeAdministrar: esAdmin,
    // Ver dashboard y métricas globales
    puedeVerDashboard: esAdmin || esJefe,
    // Ver inventario
    puedeVerInventario: esAdmin || esJefe || esBodega,
    // Crear / editar inventario y recetas
    puedeEditarInventario: esAdmin || esJefe || esBodega,
    // Ver y editar sistemas de trabajo
    puedeVerSistemas: esAdmin || esJefe || esProduccion || esInstalador,
    // Crear / modificar sistemas y sus recetas: solo super admin y jefe de taller
    puedeEditarSistemas: esAdmin || esJefe,
    // Aprobar cotizaciones
    puedeAprobar: esAdmin || esJefe,
    // Marcar terminado en taller
    puedeProducir: esAdmin || esJefe || esProduccion,
    // Tomar y medir órdenes
    puedeInstalar: esInstalador,
    // Crear órdenes nuevas (antes solo lo hacía el administrador)
    puedeCrearOrden: esAdmin || esJefe,
    // Enviar medidas tomadas en terreno
    puedeMedir: esAdmin || esJefe || esInstalador,
    // Enviar una orden a producción (aprobación del jefe)
    puedeEnviarProduccion: esAdmin || esJefe,
    // Aceptar el trabajo y mover el estado dentro del taller
    puedeAceptarProduccion: esAdmin || esJefe || esProduccion,
    puedeEnviarVidrios: esAdmin || esJefe || esProduccion,
    puedeTerminarProduccion: esAdmin || esJefe || esProduccion,
    // Herramientas: el jefe/admin asigna; producción/instalación consulta y firma checklists
    puedeVerHerramientas: esAdmin || esJefe || esProduccion || esInstalador,
    puedeAsignarHerramientas: esAdmin || esJefe,
    puedeUsarChecklists: esProduccion || esInstalador || esAdmin || esJefe,
    // Inventario propio de producción
    puedeVerProduccion: esAdmin || esJefe || esProduccion,
    puedeInventarioProduccion: esAdmin || esJefe || esProduccion || esBodega,
  };
}

// Categoría de rol equivalente a la función SQL public.categoria_rol().
// Se usa para filtrar notificaciones por grupo.
export function categoriaRol(rol) {
  const r = normalizar(rol);
  if (r.includes('admin') || r.includes('gerencia') || r.includes('super')) return 'admin';
  if (r.includes('jefe')) return 'jefe';
  if (r.includes('produccion') || r.includes('taller') || r.includes('vidriero')) return 'produccion';
  if (r.includes('instalador')) return 'instalador';
  if (r.includes('bodega') || r.includes('almacen')) return 'bodega';
  return 'otro';
}

// Vista inicial según el rol
export function vistaInicial(rol) {
  const p = permisosDe(rol);
  if (p.esInstalador) return 'ordenes';
  if (p.esProduccion && !p.esAdmin) return 'ordenes';
  return 'dashboard';
}
