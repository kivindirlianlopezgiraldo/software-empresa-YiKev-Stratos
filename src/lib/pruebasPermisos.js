import { ROLES, permisosDe } from './constants';

const CASOS_ROL = [
  {
    rol: ROLES.SUPER_ADMIN,
    esperado: {
      esSuperAdmin: true,
      puedeAdministrar: true,
      puedeVerDashboard: true,
      puedeVerInventario: true,
      puedeCalcularDespiece: true,
      puedeEditarSistemas: true,
      puedeTerminarProduccion: true,
    },
  },
  {
    rol: ROLES.JEFE_TALLER,
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: false,
      puedeVerDashboard: true,
      puedeVerInventario: true,
      puedeCalcularDespiece: true,
      puedeEditarSistemas: true,
      puedeTerminarProduccion: true,
    },
  },
  {
    rol: ROLES.PRODUCCION,
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: false,
      puedeVerDashboard: false,
      puedeCalcularDespiece: true,
      puedeVerSistemas: true,
      puedeAceptarProduccion: true,
      puedeTerminarProduccion: true,
    },
  },
  {
    rol: ROLES.INSTALADOR,
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: false,
      puedeVerDashboard: false,
      puedeCalcularDespiece: false,
      puedeVerSistemas: true,
      puedeMedir: true,
      puedeUsarChecklists: true,
    },
  },
  {
    rol: ROLES.VIDRIERO,
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: false,
      puedeVerDashboard: false,
      puedeEnviarVidrios: true,
      puedeVerProduccion: true,
    },
  },
  {
    rol: ROLES.BODEGUERO,
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: false,
      puedeVerDashboard: false,
      puedeVerInventario: true,
      puedeInventarioProduccion: true,
    },
  },
  {
    rol: 'Administrador',
    esperado: {
      esSuperAdmin: false,
      puedeAdministrar: true,
      puedeVerDashboard: true,
    },
  },
  {
    rol: 'Jefe de Taller',
    esperado: {
      esSuperAdmin: false,
    },
  },
];

export function ejecutarPruebasPermisos() {
  return CASOS_ROL.flatMap(({ rol, esperado }) => {
    const permisos = permisosDe(rol);
    return Object.entries(esperado).map(([permiso, valorEsperado]) => {
      const obtenido = Boolean(permisos[permiso]);
      return {
        rol,
        permiso,
        esperado: valorEsperado,
        obtenido,
        correcto: obtenido === valorEsperado,
      };
    });
  });
}
