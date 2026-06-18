# condor.ai · Login con código+contraseña, sync a Google Sheets, diagnóstico integrado y Haiku humano

**Fecha:** 2026-06-18
**Repos afectados:** `condor-ai-web` (sitio + portal + admin), `condorweb-diagnostico` (Edge Function `diagnostico`)
**Proyecto Supabase:** `ogmvdthxwcmvqjlxhpsr`

## Contexto

El portal de clientes (`portal.html`) y el panel admin (`admin.html`) usan login por **enlace mágico** (`signInWithOtp` con `emailRedirectTo`). Esto rompe el login cross-device: si pides el enlace en el PC y lo abres en el celular, la sesión queda en el celular y el PC nunca se actualiza (bug reportado por el usuario).

Las funciones de pago (`crear-pago`, `mp-webhook`) ya están desplegadas. La tabla `leads` ya se llena desde la Edge Function `diagnostico` (repo `condorweb-diagnostico`, hospedado aparte en GitHub Pages). La tabla `clientes` la gestiona el admin.

## Objetivos

1. Cambiar login a **código de 6 dígitos** (se escribe en la página, no enlace) → arregla el bug cross-device.
2. Habilitar **contraseña permanente**: primer ingreso con código → forzar creación de contraseña → siguientes ingresos con correo+contraseña.
3. **Sin registro público**: el acceso lo habilita el admin agregando el correo a `clientes`/`admins`.
4. Sincronizar `clientes` y `leads` a un **Google Sheet** (2 pestañas) automáticamente.
5. **Integrar el diagnóstico** dentro de `condor-ai-web` (un solo proyecto/dominio).
6. Que **Haiku responda como humano** con venta blanda hacia los servicios de condor.ai.

## Diseño por componente

### 1. Login con código + contraseña (`portal.html` y `admin.html`)

Tres estados de UI en la misma página:

- **Estado A — Ingresar:** campos `email` + `contraseña`, botón "Entrar" (`signInWithPassword`). Link secundario "Entrar con código / Olvidé mi contraseña".
- **Estado B — Código:** al pedir código se llama `signInWithOtp({ email, options: { shouldCreateUser: true } })` **sin** `emailRedirectTo` (esto hace que Supabase envíe un OTP de 6 dígitos en vez de un magic link). Campo para escribir el código → `verifyOtp({ email, token, type: 'email' })`. La sesión queda en el dispositivo actual.
- **Estado C — Crear contraseña:** se muestra solo si el usuario **no tiene contraseña marcada**. Campos contraseña + confirmar (mín. 8 caracteres, deben coincidir) → `updateUser({ password, data: { password_set: true } })`.

**Detección de contraseña:** se usa `user.user_metadata.password_set === true`. Si falta o es `false` tras un login por código, se fuerza el Estado C antes de mostrar el dashboard. Tras `signInWithPassword` exitoso no se fuerza (ya tiene contraseña).

**Sin registro público:** la UI no tiene formulario de "crear cuenta". `shouldCreateUser: true` permite que el usuario de auth se cree en el primer login por código, pero el dashboard solo muestra datos si el correo existe en `clientes` (portal) o `admins` (admin); de lo contrario muestra "tu cuenta aún no está habilitada, contáctanos". Esto satisface "solo el admin crea por demanda" sin tener que pre-crear usuarios de auth.

**Aplica igual** a `portal.html` (cliente) y `admin.html` (admin); misma lógica de 3 estados.

### 2. Sincronización a Google Sheets (Apps Script + Database Webhooks)

- **Un Google Sheet** en la cuenta Google del usuario con 2 pestañas: `Clientes` y `Leads`. Encabezados fijos en fila 1.
- **Apps Script** (web app, `doPost`) desplegado como "cualquier persona con el enlace": recibe `{ token, tabla, fila }`, valida `token` contra un secreto, y hace `appendRow` en la pestaña según `tabla`. Mapea columnas conocidas; ignora extras.
- **2 Database Webhooks de Supabase** (nativos, pg_net) sobre la BD:
  - INSERT en `public.clientes` → POST al Apps Script con `tabla: "Clientes"`.
  - INSERT en `public.leads` → POST con `tabla: "Leads"`.
  - El secreto se manda en el body (`token`) o como header. URL = la del Apps Script web app.
- No se cambia código de las Edge Functions; los leads siguen insertándose por `diagnostico` y el webhook se dispara solo.
- (Futuro, fuera de v1) Sync en UPDATE de `clientes` para reflejar cambios de estado de pago.

### 3. Diagnóstico integrado al sitio

- Copiar la página del quiz (`condorweb-diagnostico/index.html` + assets necesarios: orbe 3D, fuentes, config) dentro de `condor-ai-web` como **`diagnostico-quiz.html`**.
- Reapuntar los botones que hoy van a `https://joaquinmunozs.github.io/condorweb-diagnostico/`:
  - `diagnostico.html` (2 botones: hero CTA y CTA inferior).
  - `index.html` (botón "Empezar gratis").
  - Cualquier otro enlace al diagnóstico externo dentro del repo.
- La config interna del quiz (`FUNCTION_URL`, `ANON_KEY`, `WHATSAPP`) se mantiene igual (apunta a la misma Edge Function `diagnostico` y proyecto Supabase).
- El repo externo `condorweb-diagnostico` puede quedar como estaba; la versión "oficial" pasa a vivir en `condor-ai-web`.

### 4. Login en el nav del sitio

- Agregar enlace **"Acceso clientes"** en el `nav` de las páginas, al lado de "Nosotros", apuntando a `portal.html`. **Sin** opción de registro.
- Aplicar al nav repetido en las páginas del sitio (index y demás), respetando el markup/estilo existente del nav.

### 5. Haiku responde como humano + venta blanda

- Editar el *system prompt* de la Edge Function `diagnostico` (repo `condorweb-diagnostico`):
  - Tono: **asesor humano cálido y cercano**, en primera persona como alguien del equipo de condor.ai; nada de "soy una IA/bot".
  - La recomendación final orienta, **sin pedir la contratación explícitamente**, hacia los servicios de condor.ai: una **página web 3D/4K** moderna para atraer más clientes, mejorar la **presencia en Google Maps**, videos con IA, etc., según el diagnóstico del lead.
  - Se mantiene el **structured output** existente (`categoria`, `prioridad`, `diagnostico`, `problemas`, `recomendacion`); solo cambia el contenido/tono de los campos de texto.
- Redeploy de la función `diagnostico` (`--no-verify-jwt`) tras el cambio.

### 6. Ajuste de estadísticas del sitio

- Cambiar todas las menciones de entrega **"24–72h" → "48–72h"** (y variantes "24 a 72 horas" → "48 a 72 horas", "24 y 72 horas" → "48 y 72 horas"). Ubicaciones: `index.html` (meta, lead, hstat), `nosotros.html`, `paginas-web.html` (meta, h2), `precios.html` (tick y FAQ), `servicios.html`.
- **Eliminar** la estadística **"+500 negocios"**: la tarjeta `+500 / Negocios potenciados` en `nosotros.html` y el `hstat` `+500 / Negocios` en `index.html`.

## Datos y seguridad

- El **secreto del Apps Script** se guarda en la config del Database Webhook (no en frontend).
- RLS de `clientes`/`leads` se mantiene (solo service role escribe). El portal lee la fila del cliente vía su sesión autenticada con políticas ya existentes.
- Contraseñas gestionadas por Supabase Auth (no se guardan en tablas propias).

## Fuera de alcance (v1)

- Recuperación de contraseña por separado (el flujo "entrar con código" ya cubre el caso de olvido).
- Sync de updates/borrados a Sheets (solo inserts en v1).
- Pre-creación de usuarios de auth por el admin (se crean en el primer login por código).

## Pasos manuales del usuario (post-implementación)

1. Crear el Google Sheet con pestañas `Clientes` y `Leads` + pegar el Apps Script y deployarlo (web app) → copiar URL.
2. Crear los 2 Database Webhooks en Supabase con esa URL + el token secreto.
3. Probar: login por código en PC, crear contraseña, reingresar con contraseña; crear un cliente y un lead de prueba y verificar que aparecen en el Sheet.
