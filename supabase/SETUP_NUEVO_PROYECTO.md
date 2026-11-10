# Puesta en marcha en un proyecto nuevo de Supabase

El proyecto ya está instalado en esta carpeta. Sigue estos pasos solo si vas a
usar una base de datos **nueva**; si quieres seguir usando la base actual,
salta al paso 5.

## 1. Crear el proyecto en Supabase

1. Entra en <https://supabase.com/dashboard> y crea un proyecto.
2. Espera a que termine de aprovisionarse.
3. En **Project Settings → API** copia:
   - `Project URL`
   - `anon public key` (la clave pública; **nunca** uses `service_role` en el frontend).

## 2. Crear el esquema

1. Abre **SQL Editor → New query** en el proyecto nuevo.
2. Copia **todo** el contenido de [`migrations/001_identidad_y_rls.sql`](migrations/001_identidad_y_rls.sql).
3. Pega y pulsa **Run**.

Ese único script:

- crea las 5 tablas (`perfiles_usuario`, `ordenes_trabajo`, `inventario_materiales`,
  `sistemas_trabajo`, `sistema_materiales`);
- agrega las columnas del flujo de órdenes;
- crea las funciones de permisos y el trigger anti-escalada;
- activa RLS, revoca el acceso a `anon` y concede lo necesario a `authenticated`.

> Es idempotente: si lo vuelves a ejecutar, no rompe nada. También sirve para
> actualizar la base actual (solo agrega lo que falte).

### 2.1 Migración 002: dirección, notas y fotos de referencia

En el mismo **SQL Editor**, abre una consulta nueva, pega **todo** el contenido de
[`migrations/002_medidas_referencias.sql`](migrations/002_medidas_referencias.sql)
y pulsa **Run**.

Ese script:

- agrega a `ordenes_trabajo` las columnas `cliente_direccion`, `cliente_barrio`,
  `notas_medidas`, `imagenes_referencia`, `medido_en` y `medido_por`;
- crea el bucket **privado** `referencias` (5 MB por archivo, JPG/PNG/WEBP);
- define las políticas para que solo usuarios autenticados suban y lean las fotos.

> También es idempotente. Sin esta migración, la app muestra “Sin dirección
> registrada” y no puede guardar fotos.

### 2.2 Migración 003: administración de empleados y empresa

En el mismo **SQL Editor**, abre una consulta nueva, pega **todo** el contenido de
[`migrations/003_admin_empresa.sql`](migrations/003_admin_empresa.sql) y pulsa **Run**.

Ese script:

- amplía `perfiles_usuario` con fecha de nacimiento, correo personal, dirección,
  ciudad, fecha de ingreso, EPS, ARL, contacto de emergencia, tallas de dotación y notas;
- crea la tabla `empresa_config` (una sola fila) con NIT, razón social, contactos,
  representante legal, información bancaria y horario;
- actualiza el trigger para que solo un administrador pueda cambiar contrato,
  salario, departamento, fecha de ingreso, documento o estado activo;
- deja la empresa legible para todo el personal, pero editable solo por administradores;
- crea la vista pública `empresa_publica` con los datos de contacto que usa la landing:
  nombre, NIT, dirección, ciudad, teléfonos, correo, web y horario. **No** expone banco
  ni representante legal.

> Sin esta migración, el módulo **Empresa** y los campos ampliados de **Empleados**
> no pueden guardar datos.

### 2.3 Migración 004: proyectos y textos de la landing

En el mismo **SQL Editor**, abre una consulta nueva, pega **todo** el contenido de
[`migrations/004_proyectos_landing.sql`](migrations/004_proyectos_landing.sql) y pulsa
**Run**.

Ese script:

- crea la tabla `proyectos` con título, categoría, cliente, ubicación, año, descripción,
  materiales, arreglo JSON de fotos, destacado, publicado y orden;
- crea la tabla `landing_config` (una sola fila) con los textos de portada, nosotros,
  proyectos y contacto, además del mensaje inicial de WhatsApp;
- crea las vistas públicas `proyectos_publicos` (solo publicados) y `landing_publica`;
- crea el bucket **público** `proyectos` (5 MB por archivo, JPG/PNG/WEBP) para las fotos
  de marketing;
- permite que todo el personal autenticado lea la información, pero solo un administrador
  puede crear, editar, publicar o borrar proyectos y textos.

> Sin esta migración, el módulo **Sitio web** muestra el aviso para aplicarla y la landing
> oculta la sección de proyectos. Los textos base siguen funcionando.

### 2.4 Migración 005: producción, herramientas y notificaciones

En el mismo **SQL Editor**, abre una consulta nueva, pega **todo** el contenido de
[`migrations/005_produccion_herramientas_ia.sql`](migrations/005_produccion_herramientas_ia.sql)
y pulsa **Run**.

Ese script:

- agrega a `ordenes_trabajo` el origen, responsable de producción, fotos del producto
  terminado, despiece calculado y control de medidas de vidrio;
- crea `orden_items` para varios proyectos/ventanas dentro de una misma orden;
- crea `orden_vidrios` para las medidas que producción envía al jefe de taller;
- crea `notificaciones` por persona (`usuario_id`) o por grupo (`rol_destino`);
- crea `herramientas`, `herramienta_checklists` y `herramienta_registros` con RLS;
- crea `inventario_produccion` para los insumos propios del taller;
- amplía `sistemas_trabajo` y `sistema_materiales` con tipo de pieza, fórmula de corte,
  descuentos, merma y orden;
- permite que el jefe de taller cree órdenes y administre sistemas y recetas;
- inserta las plantillas de checklist **Salida a instalación** y **Entrada al taller**.

> Sin esta migración, los módulos de Producción, Herramientas y Notificaciones muestran un
> aviso para aplicarla; la app sigue funcionando y la campana queda en 0.

### 2.5 Migración 006: salidas y entradas de herramientas

En el **SQL Editor**, abre otra consulta, pega todo el contenido de
[`migrations/006_herramientas_movimientos.sql`](migrations/006_herramientas_movimientos.sql)
y pulsa **Run**.

Ese script:

- crea `herramienta_movimientos`, con una fila por herramienta y por movimiento
  (`salida` o `entrada`), agrupadas por `lote_id` para formar el acta;
- guarda colaborador, orden, estado anterior/nuevo, novedad y quién registró;
- agrega la columna `herramientas` a `herramienta_registros` para dejar en la firma del
  checklist qué herramientas salieron o entraron;
- habilita RLS: jefe/admin registra movimientos y cada colaborador ve los suyos.

Con esto, en **Herramientas** aparecen los botones **Salida de herramientas** (elige
colaborador, marca varias herramientas de la lista y opcionalmente una orden y un
checklist) y **Registrar entrada** (marca las que devuelve), más la pestaña
**Movimientos** con el historial.

> Si no aplicas la 006, la asignación individual sigue funcionando; los botones de
> salida/entrada mostrarán el aviso de migración faltante.

### 2.6 Migración 007: kits de herramientas por rol

Ejecuta [`migrations/007_herramientas_kits.sql`](migrations/007_herramientas_kits.sql) en el
**SQL Editor**.

Ese script:

- crea `herramienta_kits` con nombre, área destino (`produccion`, `instalador`, `bodega`,
  `otro`) y la lista de herramientas;
- permite que todo el personal consulte los kits y que solo jefe/admin los edite;
- inserta el **Kit de producción** y el **Kit de instalación** como base.

Al registrar una salida, el selector **Kit por rol** muestra los kits del área del
colaborador elegido y marca automáticamente las herramientas disponibles cuyo nombre
coincida. Si falta alguna, la app avisa cuáles no hay.

### 2.7 Migración 008: despiece avanzado y retales

Ejecuta [`migrations/008_despiece_avanzado_retales.sql`](migrations/008_despiece_avanzado_retales.sql)
en el **SQL Editor**.

Ese script:

- agrega `sistemas_trabajo.largo_barra_cm` con valor por defecto **595 cm**;
- agrega `sistema_materiales.formula_config` y `angulo_corte` para configurar por pieza:
  `{ base, restarCm, dividir, referencia, angulo, ladoAngulo }`;
- crea la tabla `retales_produccion` (material, color, largo, cantidad, ubicación y
  disponibilidad) con RLS para admin, jefe, taller y bodega;
- crea/actualiza los sistemas **Sistema 50/20** y **Cabina de Baño** con sus recetas
  completas, materiales y fórmulas.

### 2.8 Ajuste de receta 50/20

Ejecuta [`migrations/009_ajuste_receta_50_20.sql`](migrations/009_ajuste_receta_50_20.sql)
después de la migración 008. Actualiza la receta existente del Sistema 50/20, incluyendo
dos horizontales por ventana, cada uno con corte `(ancho − 2.8 cm) ÷ 2`.

> Los materiales creados por la plantilla quedan con precio y stock en 0. Ajusta precios y
> existencias en **Inventario** antes de usar el costo estimado.

Sin la migración 008, la app sigue funcionando, pero **Inventario de Producción → Retales**
muestra el aviso para aplicarla y el despiece usa el largo de barra por defecto (595 cm).

### 2.9 Migración 010: materiales escritos en las recetas

Ejecuta [`migrations/010_materiales_manuales_receta.sql`](migrations/010_materiales_manuales_receta.sql)
después de la migración 009.

Esta migración permite escribir en texto el nombre de perfiles, vidrios, accesorios o empaques
directamente en la receta del sistema, aunque no estén registrados en el inventario general.
Las cantidades se guardan por separado y el tipo de pieza se selecciona para calcular el
despiece. Si el nombre coincide con un material del inventario, se conserva su vínculo y costo.
Después de ejecutarla, la migración solicita recargar la caché del esquema de la API. Si ya la
ejecutaste y la app sigue mostrando que falta `material_nombre`, ejecuta
`NOTIFY pgrst, 'reload schema';` en el SQL Editor y vuelve a intentar guardar.

### 2.10 Edge Function del asistente virtual (opcional)

El chatbot funciona sin IA con respuestas guiadas locales. Para activar la IA:

```powershell
supabase functions deploy chat --no-verify-jwt
```

Luego, en **Supabase → Edge Functions → Secrets**, define:

| Variable | Obligatoria | Descripción |
|---|---|---|
| `AI_API_KEY` | Sí, para IA real | Clave de un proveedor compatible con OpenAI |
| `AI_BASE_URL` | No | Por defecto `https://api.openai.com/v1` |
| `AI_MODEL` | No | Por defecto `gpt-4o-mini` |

### 2.11 Restablecer contraseña de un colaborador

Despliega la función administrativa que permite al **Super Admin** asignar una nueva
contraseña sin conocer la anterior:

```powershell
supabase functions deploy restablecer-contrasena --no-verify-jwt
```

La función valida el token de sesión con Supabase Auth y vuelve a comprobar en el servidor
que el perfil solicitante tenga exactamente el rol `Super Admin` y esté activo. Requiere
las variables de entorno administradas por Supabase `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`; no copies ni configures la clave `service_role` en el frontend.
La contraseña nueva debe tener al menos 8 caracteres. El administrador debe comunicarla al
colaborador por un canal seguro.

También puedes ejecutar `supabase/seed_demo.mjs` para cargar datos de demostración
(idempotente, nunca sobrescribe datos reales).

## 3. Desactivar la confirmación de email

En **Authentication → Providers → Email**, desactiva **Confirm email**.

El login usa emails internos `documento@yikevstratos.local` que no existen; si la
confirmación está activa, los colaboradores no podrán entrar.

## 4. Crear el primer administrador

Opción A (recomendada, desde el panel):

1. **Authentication → Users → Add user**.
2. Email: `<documento>@yikevstratos.local` (por ejemplo `1234567890@yikevstratos.local`).
3. Marca **Auto Confirm User** y define la contraseña.
4. Ejecuta en el SQL Editor:

```sql
insert into public.perfiles_usuario
  (id, nombre_completo, documento_id, rol, activo)
select u.id, 'Administrador', '1234567890', 'Super Admin', true
from auth.users u
where u.email = '1234567890@yikevstratos.local'
on conflict (id) do update
  set rol = excluded.rol,
      activo = true;
```

Opción B (todo por SQL): edita las variables de
[`crear_usuario.sql`](crear_usuario.sql) y ejecútalo en el SQL Editor.

## 5. Configurar la app

En `.env` reemplaza los dos valores por los del proyecto nuevo:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima_publica
```

Si vas a seguir usando la base actual, deja el `.env` como está.

## 6. Arrancar

```powershell
npm run dev
```

Abre <http://localhost:5173/> e inicia sesión con el **documento** y la
**contraseña** del administrador.

## Notas

- Eliminar un colaborador borra su perfil, pero no su cuenta de `auth.users`.
  Bórrala desde el panel de Supabase.
- Las actualizaciones en vivo de órdenes requieren publicar `ordenes_trabajo` en
  **Database → Replication**.
- No pongas la clave `service_role` en `.env` ni en el frontend.
