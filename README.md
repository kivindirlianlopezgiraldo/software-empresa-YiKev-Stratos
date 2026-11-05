# YiKev Stratos ERP

Sistema de gestión para taller de **aluminio, vidrio, PVC y acrílico** (Quibdó, Chocó).

Cubre el ciclo completo de un trabajo: solicitud de medida → bolsa de instaladores →
medidas en terreno → cotización → producción en taller → entrega, además de inventario,
recetas de sistemas, herramientas con checklists, notificaciones internas y gestión de
personal.

Incluye un **asistente virtual con IA** para la landing pública y para el personal del
taller, con respuestas guiadas de respaldo cuando la IA no está configurada.

## Stack

| Pieza | Versión |
|---|---|
| React | 19 |
| Vite | 8 (Rolldown) |
| Tailwind CSS | 3.4 |
| Supabase | `@supabase/supabase-js` 2.118 |
| Iconos | lucide-react |

## Requisitos

- Node.js 20 o superior (probado con el runtime del sistema en Windows 11)
- Un proyecto de Supabase

## Puesta en marcha

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run dev
```

`.env` debe contener:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_publica
```

> La `anon key` es pública por diseño. La seguridad real la da **RLS** en Supabase,
> nunca el ocultamiento de la clave.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint (debe pasar sin errores) |

En Windows, si PowerShell bloquea `npm.ps1`, usa `npm.cmd run build`.

## Sitio web público

La raíz del proyecto muestra una **landing page pública** antes del inicio de sesión:
servicios, soluciones, proyectos realizados, proceso, información del taller y un
formulario de contacto.

- El botón **Ingresar** abre `Login.jsx`; desde allí se puede volver al sitio.
- Al cerrar sesión se regresa a la landing.
- Los datos de contacto (dirección, teléfonos, correo, horario) se leen de la vista
  pública `empresa_publica`, que expone **solo** información comercial. Nunca se publican
  datos bancarios ni del representante legal.
- Los proyectos se leen de la vista `proyectos_publicos`; solo aparecen los marcados como
  **publicados**. Las fotos de marketing viven en el bucket público `proyectos`.
- Los textos de portada, nosotros, proyectos y contacto se leen de `landing_publica`.
- Mientras las migraciones 003 y 004 no estén aplicadas, la landing usa los valores base
  del archivo `src/pages/Landing.jsx`.
- El formulario no envía datos a un servidor: abre WhatsApp (o el correo) con el mensaje
  ya redactado. Si no hay canales configurados, muestra un aviso.

Para cambiar el teléfono, correo o dirección que aparecen en el sitio, entra como
administrador a **Empresa**. Para publicar trabajos y editar los textos del sitio, entra a
**Sitio web**.

## Producción y despiece

Al crear o editar una orden se pueden agregar **varios proyectos/ventanas** para el mismo
cliente. Cada ítem guarda sistema, medidas, cantidad, tipo de vidrio, espesor y color.

- La **dirección es obligatoria** al crear o editar una orden; el barrio es opcional.
- Al guardar se puede enviar al **instalador para medición** o pasar directo a
  **producción**.
- Al enviar a producción, el frontend calcula el despiece con la receta del sistema y lo
  guarda como instantánea JSONB en `ordenes_trabajo.despiece`.
- El despiece incluye cortes de perfiles (con descuentos y merma), barras de 6 m, medidas
  exactas de vidrio, accesorios, cantidades y costo estimado.
- Producción puede aceptar el trabajo, cambiar su estado, enviar las **medidas de vidrio**
  al jefe de taller y subir una **foto del producto terminado**.
- El motor de cálculo vive en `src/lib/despiece.js` y la vista reutilizable en
  `src/components/DespiecePanel.jsx`.

## Herramientas e inventario de producción

- El jefe de taller y el administrador asignan herramientas a cada colaborador desde
  **Herramientas y Checklists**.
- Producción e instalación firman checklists de **salida** y **entrada**, marcan cada punto
  y registran novedades.
- El catálogo, las plantillas de checklist y los registros son independientes del
  inventario general de materiales.
- **Inventario de Producción** permite a cada colaborador consultar y editar sus insumos,
  ajustar stock (±1), definir mínimos y ubicación. El jefe y el administrador ven todo.
- **Notificaciones** avisa por persona o por grupo (producción, instalador, bodega…) cuando
  entra un trabajo, se envían medidas o hay novedades de herramientas. La campana del menú
  muestra el contador de no leídas.

## Asistente virtual (chatbot IA)

Hay dos modos del mismo widget flotante:

- **Landing** (`<Chatbot modo="landing" />`): responde sobre servicios, materiales, zonas,
  tiempos y cómo pedir una cotización. Está a la izquierda para no tapar WhatsApp.
- **ERP** (`<Chatbot modo="empleado" />`): recibe nombre, rol y vista actual del usuario y
  orienta sobre órdenes, despiece, medidas de vidrio, inventario y herramientas.

El cliente está en `src/lib/chat.js` y llama a la Edge Function `chat`. Si la función no está
desplegada o no tiene clave de IA, responde con una guía local para que el chat nunca quede
vacío.

### Desplegar la Edge Function

```bash
supabase functions deploy chat --no-verify-jwt
```

Configura los secretos en **Supabase → Edge Functions → Secrets**:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `AI_API_KEY` | Sí, para IA real | Clave del proveedor compatible con OpenAI |
| `AI_BASE_URL` | No | Por defecto `https://api.openai.com/v1` |
| `AI_MODEL` | No | Por defecto `gpt-4o-mini` |

Sin `AI_API_KEY` el asistente sigue funcionando con respuestas guiadas locales.

## Modelo de autenticación

El personal inicia sesión con su **número de documento**, no con email. Como Supabase Auth
exige un email, se usa un email interno determinista:

```
<documento>@yikevstratos.local
```

- `Login.jsx` deriva el email del documento y llama a `signInWithPassword`.
- `Colaboradores.jsx` crea la cuenta con `signUp` y luego inserta la fila en
  `perfiles_usuario` enlazada por `id`.
- `App.jsx` escucha `onAuthStateChange` y carga el perfil por `auth.uid()`.
- La sesión ya **no** se guarda en `localStorage` a mano: Supabase la gestiona y refresca.

### Requisito en Supabase

En **Authentication → Providers → Email**, desactiva *Confirm email*. Con la confirmación
activa, `signUp` no devuelve sesión y el colaborador no podría entrar hasta confirmar un
correo que no existe.

## Base de datos

Tablas usadas:

| Tabla | Contenido |
|---|---|
| `perfiles_usuario` | Colaboradores: `id` (= auth uid), `documento_id`, nombre, rol, salario… |
| `ordenes_trabajo` | Órdenes y su estado en el flujo |
| `inventario_materiales` | Perfiles, vidrios, herrajes, precios |
| `sistemas_trabajo` | Sistemas/recetas de ventanería |
| `sistema_materiales` | Materiales que componen cada sistema |
| `empresa_config` | Datos legales, contacto, representante y banco de la empresa (una sola fila) |
| `proyectos` | Portafolio: título, categoría, cliente, ubicación, año, fotos y publicación |
| `landing_config` | Textos editables de la landing (una sola fila) |
| `orden_items` | Varios proyectos/ventanas dentro de una misma orden, con medidas y sistema |
| `orden_vidrios` | Medidas de vidrio que producción envía al jefe de taller |
| `notificaciones` | Avisos por persona (`usuario_id`) o por grupo (`rol_destino`) |
| `herramientas` | Catálogo y asignación de herramientas a colaboradores |
| `herramienta_checklists` | Plantillas de salida y entrada del taller |
| `herramienta_registros` | Checklists firmados, con novedades y orden asociada |
| `inventario_produccion` | Insumos y consumibles propios del taller por colaborador |

Estados de una orden (deben coincidir exactamente):

1. `Pendiente de Asignación`
2. `Asignado a Instalador`
3. `Cotización Pendiente`
4. `Pendiente de Producción`
5. `En Producción`
6. `Listo para Entrega / Finalizado`
7. `Entregado`

Están centralizados en `src/lib/constants.js` (`ESTADOS`). **No** los escribas a mano en
otros archivos.

### Migración

Ejecuta en orden los scripts de `supabase/migrations/` en el SQL Editor de Supabase.
Respalda antes. Son idempotentes.

| Script | Contenido |
|---|---|
| `001_identidad_y_rls.sql` | Esquema base, funciones de permisos, RLS y trigger anti-escalada |
| `002_medidas_referencias.sql` | Dirección/barrio, notas de medidas, fotos y bucket privado `referencias` |
| `003_admin_empresa.sql` | Datos ampliados de empleados, tabla `empresa_config` y vista pública `empresa_publica` |
| `004_proyectos_landing.sql` | Portafolio `proyectos`, textos `landing_config`, vistas públicas y bucket público `proyectos` |
| `005_produccion_herramientas_ia.sql` | Ítems de orden, medidas de vidrio, notificaciones, herramientas, checklists, inventario de producción y recetas ampliadas |
| `006_herramientas_movimientos.sql` | Historial de salidas y entradas de herramientas por colaborador, con actas por lote y orden asociada |
| `007_herramientas_kits.sql` | Kits de herramientas por rol (producción, instalación, bodega) y kits base |

La 001, además:

1. Crea las 5 tablas si no existen (sirve para un proyecto **nuevo** de Supabase).
2. Normaliza `cedula` → `documento_id`.
3. Añade a `ordenes_trabajo` las columnas que usa el flujo: `tipo_trabajo`,
   `instalador_id`, `instalador_nombre`, `entregado_en` (y `cliente_nombre`,
   `cliente_telefono`, `medidas_terreno`, `creado_en` si faltan).
4. Crea funciones de permisos y un trigger anti-escalada de privilegios.
5. Activa **RLS** en todas las tablas con políticas por rol.
6. Incluye el bloque para promover al **primer administrador** (bootstrap).
7. (Opcional, comentado) corrige los emails de Auth existentes.
8. (Opcional, comentado) elimina la columna `password` en texto plano.

> **Primer acceso:** crea tu usuario en *Authentication → Users* con email
> `<documento>@yikevstratos.local` y luego promuévelo con el bloque 5 de la migración.
> Sin ese paso nadie puede insertar perfiles, porque RLS exige ser admin.

> **Proyecto nuevo:** sigue la guía paso a paso en
> `supabase/SETUP_NUEVO_PROYECTO.md`. El script `supabase/crear_usuario.sql`
> crea o repara una cuenta de acceso (Auth + perfil) desde el SQL Editor.

> **Importante:** mientras la migración no se ejecute en el proyecto al que apunta
> `.env`, la clave pública (`anon`) puede leer todas las tablas y el alta de órdenes
> fallará porque faltan `tipo_trabajo`, `instalador_id`, `instalador_nombre` y
> `entregado_en`. Verifica que estás en el proyecto correcto antes de ejecutarla.

> **Migración 005:** si aún no está aplicada, los módulos de Producción, Herramientas y
> Notificaciones muestran un aviso con el nombre del script, la campana queda en 0 y la
> orden se guarda sin ítems. Nada se rompe: aplica
> `supabase/migrations/005_produccion_herramientas_ia.sql` y recarga.

> **Migración 006:** habilita el registro de **salidas y entradas de varias herramientas**
> por colaborador y la pestaña **Movimientos** con el historial. Sin ella, la asignación
> individual de herramientas sigue funcionando y los botones nuevos avisan que falta el
> script `supabase/migrations/006_herramientas_movimientos.sql`.

> **Migración 007:** agrega los **kits por rol** (Producción, Instalación, Bodega). Al
> registrar una salida eliges el kit de esa área y se marcan solas las herramientas
> disponibles que coincidan. Sin ella, la salida funciona con selección manual.

### Datos de demostración

`supabase/seed_demo.mjs` carga materiales, sistemas, recetas con metadatos de despiece,
órdenes con varios ítems, medidas de vidrio, notificaciones, herramientas, checklists,
registros e inventario de producción.

```powershell
$env:ADMIN_DOCUMENTO="TU_DOCUMENTO"
$env:ADMIN_PASSWORD="TU_CONTRASENA_SEGURA"
node supabase/seed_demo.mjs
```

Es idempotente y **solo completa lo que falta**: no sobrescribe precios, textos,
proyectos ni datos reales ya editados.

## Estructura

```
src/
├─ App.jsx                 # Sesión, navegación, permisos, campana y chatbot
├─ components/             # Toast, Modal, DespiecePanel, Chatbot
├─ hooks/useToast.js       # Notificaciones con autocierre
├─ lib/
│  ├─ auth.js              # Login y creación de cuentas
│  ├─ chat.js              # Cliente del asistente y respaldo local
│  ├─ constants.js         # Roles, estados, catálogos, permisos
│  ├─ despiece.js          # Cálculo de cortes, vidrios y accesorios
│  ├─ format.js            # COP, fechas, UUID seguro
│  ├─ notificaciones.js    # Crear, cargar y marcar notificaciones
│  ├─ proyectos.js         # Fotos públicas del portafolio y URLs
│  └─ supabase.js          # Cliente
└─ pages/                  # Landing, Login, Dashboard, Órdenes, Inventario,
                           # InventarioProduccion, Herramientas, Notificaciones,
                           # Sistemas, Colaboradores, Empresa, SitioWeb, Perfil
```

## Roles y permisos

| Rol | Dashboard | Órdenes | Sistemas | Inventario | Producción | Herramientas | Notificaciones | Empleados | Empresa | Sitio web |
|---|---|---|---|---|---|---|---|---|---|---|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Jefe de Taller | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Producción / Vidriero | ❌ | ✅ | ✅ (lectura) | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Instalador | ❌ | ✅ | ✅ (lectura) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Bodeguero | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

> La información de la empresa se puede **leer** desde cualquier sesión autenticada,
> pero solo un administrador puede modificarla. Los empleados inactivos ven la pantalla
> “Acceso desactivado” en lugar del sistema.

Los permisos de la interfaz están en `permisosDe()` (`src/lib/constants.js`) y se replican
en las políticas RLS del servidor. **Ocultar un botón no es seguridad**: la fuente de
verdad es RLS.

## Limitaciones conocidas

- Eliminar un colaborador borra su perfil, pero **no** su cuenta de `auth.users`
  (requiere `service_role`, que nunca debe estar en el frontend). Bórrala desde el panel
  de Supabase o con una Edge Function.
- Restablecer la contraseña de otro usuario también requiere una Edge Function con
  `service_role`.
- Las actualizaciones "en vivo" necesitan que la tabla `ordenes_trabajo` esté publicada
  en **Database → Replication**.
"# software-empresa-YiKev-Stratos" 
