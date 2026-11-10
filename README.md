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
- El despiece aplica automáticamente los **descuentos de cada sistema** al escribir las
  medidas. Por ejemplo, en el **50/20**: sillar y cabezal al ancho total, jamba = alto − 1.3 cm
  con corte a 5° en el lado del sillar, tope y enganche = alto − 3 cm y dos horizontales de
  (ancho − 2.8 cm) ÷ 2. La receta lleva 1 cabezal, 1 sillar, 2 jambas, 2 topes, 2 enganches,
  2 horizontales, 1 seguro y 4 rodachinas por ventana. En la
  **cabina de baño**: War 12 alto = alto − 3 cm, PV17 fija = alto − 4.5 cm, PV17 corrediza =
  alto − 5.5 cm, PV17 ancho = (ancho − 1 cm) ÷ 2 y barra toallera = PV17 ancho − 9 cm.
- Cada línea de receta guarda una `formula_config`:
  `{ base, restarCm, dividir, referencia, angulo, ladoAngulo }`. La fórmula es
  `(base − restarCm − descuento_mm/10) ÷ dividir` y puede tomar la medida de otra pieza
  (por ejemplo, la barra toallera usa la medida del PV17 ancho).
- El perfil de aluminio se maneja en **barras de 595 cm** (`sistemas_trabajo.largo_barra_cm`).
- Antes de pedir barras nuevas, el motor compara cada pieza con los **retales disponibles**
  en producción (`retales_produccion`) por material, color y largo. Los retales se consumen
  primero y solo lo que no cabe se convierte en barras nuevas.
- En **Sistemas y Recetas** cada sistema tiene un botón **Descuentos** con un panel propio
  para crear, editar o eliminar las piezas de la receta (perfil, vidrio, accesorio o empaque),
  ajustar piezas, restar centímetros, divisores, ángulos, referencias, descuento en mm y merma.
  El panel calcula un **despiece de muestra** con las medidas que escribas, para ver de
  inmediato cuánto material se necesita antes de guardar.
- La línea o perfilería y el tipo del sistema admiten valores manuales además de sugerencias.
  Los descuentos generales de perfil por ancho y alto se aplican según la fórmula de cada corte;
  las reglas particulares siguen configurándose por pieza en **Descuentos**.
- **Calculadora de Despiece** permite a Super Admin, Jefe de Taller y Producción seleccionar un
  sistema, ingresar ancho, alto, unidades y color, y ver cortes, vidrio, accesorios y barras sin
  crear ni modificar una orden. Las recetas y descuentos solo los editan Super Admin y Jefe de Taller.
- Al crear un **Nuevo Sistema**, el botón de guardado dice **“Guardar y agregar ítems”** y,
  al terminar, se abre automáticamente el panel **Descuentos** para cargar de una vez los
  perfiles, vidrios, accesorios y empaques que lleva el sistema.
- El despiece incluye cortes de perfiles (con descuentos, ángulo y merma), medidas exactas
  de vidrio, accesorios, cantidades, retales aprovechados, barras nuevas y costo estimado
  de compra.
- Desde la ficha de la orden (y en la tabla de órdenes) se puede **descargar o imprimir la
  orden de producción**: datos del proyecto, cortes, retales, barras, vidrios, accesorios,
  advertencias y espacio para firmas. Se genera como HTML imprimible en una ventana nueva
  (guardar como PDF desde el diálogo de impresión).
- La sección **“Vidrios · medidas de corte”** imprime el ancho y el alto exactos de cada
  vidrio por proyecto (no solo el área), para poder cortar y ensamblar sin ambigüedad.
- Si el vidrio pedido en la orden (tipo y espesor) no coincide con el de la receta del
  sistema, la orden muestra un aviso **“Revisar vidrio antes de cortar”** y la medida
  solicitada. Así se evita instalar un vidrio distinto al que pidió el cliente, incluso en
  órdenes guardadas antes de este control.
- Solo el **Super Admin** y el **Jefe de Taller** pueden crear o modificar sistemas, recetas,
  fórmulas y descuentos. Los demás roles ven un aviso y no tienen acceso al menú; la base de
  datos también lo restringe con RLS.
- Producción puede aceptar el trabajo, cambiar su estado, enviar las **medidas de vidrio**
  al jefe de taller y subir una **foto del producto terminado**.
- El motor de cálculo vive en `src/lib/despiece.js`, la orden imprimible en
  `src/lib/ordenProduccion.js` y la vista reutilizable en
  `src/components/DespiecePanel.jsx`.

## Herramientas e inventario de producción

- El jefe de taller y el administrador asignan herramientas a cada colaborador desde
  **Herramientas y Checklists**.
- **Salida de herramientas** entrega varias unidades de la lista a un colaborador, con orden
  opcional y checklist. **Registrar entrada** devuelve solo las que tiene asignadas.
- Los **kits por rol** (Producción, Instalación, Bodega) marcan automáticamente las
  herramientas recomendadas para el área del colaborador.
- Cada acta de la pestaña **Movimientos** se puede imprimir como **carta responsiva** o
  **acta de devolución** (con datos del colaborador, herramientas, novedad y firmas).
- Producción e instalación firman checklists de **salida** y **entrada**, marcan cada punto
  y registran novedades.
- El catálogo, las plantillas de checklist y los registros son independientes del
  inventario general de materiales.
- **Inventario de Producción** permite a cada colaborador consultar y editar sus insumos,
  ajustar stock (±1), definir mínimos y ubicación. El jefe y el administrador ven todo.
- La pestaña **Retales de perfil** del mismo módulo registra los sobrantes de producción
  (material, color, largo, cantidad y ubicación). Se pueden editar, marcar como no
  disponibles o eliminar; el despiece los reutiliza automáticamente.
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
| `008_despiece_avanzado_retales.sql` | Barras de 595 cm, fórmula avanzada por pieza (descuentos, divisores, referencias y ángulos), tabla `retales_produccion` y plantillas 50/20 + cabina de baño |
| `009_ajuste_receta_50_20.sql` | Ajusta la receta 50/20: dos horizontales por ventana, cada uno de (ancho − 2.8 cm) ÷ 2 |

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
