# CLAUDE.md — Radar Social La Rioja

> **Proyecto:** Radar Social La Rioja — admin de monitoreo de redes sociales.
> **Repo / carpeta raíz:** `radar-social` · **Base de datos:** `radar_social`
> **Título visible (dashboard):** "Radar Social La Rioja" (versión corta: "Radar Social")
>
> Archivo de contexto maestro para Claude Code.
> Colocar en la raíz del repositorio. Claude Code lo lee automáticamente
> al iniciar y lo usa como referencia de arquitectura en cada tarea.

---

## 1. Resumen del proyecto

**Radar Social La Rioja** es un panel de administración, desarrollado para una
agencia de La Rioja (Argentina), para monitorear las cuentas de **Facebook,
Instagram, X (Twitter) y TikTok** de un cliente con acceso autorizado.

El objetivo es centralizar en un solo lugar:

- **Gestión de cuentas desde el propio admin**: el usuario conecta cada cuenta
  desde la interfaz (flujo OAuth), sin tocar tokens a mano. Según la plataforma
  elegida, el sistema pide los datos/permisos que corresponden.
- **Métricas propias**: seguidores, alcance, impresiones, engagement.
- **Publicaciones y su rendimiento**: posts nuevos, likes, comentarios, shares, vistas.
- **Comentarios / menciones sobre las cuentas propias del cliente** (no listening amplio en esta fase).

El sistema guarda **snapshots históricos** para poder mostrar tendencias en el
tiempo, no solo la foto del momento que devuelven las APIs.

### Alcance explícito
- **EN ALCANCE (fase 1):** cuentas del cliente, conectadas vía OAuth desde el
  propio admin. Datos de las APIs oficiales. Comentarios sobre publicaciones
  propias. Alta, baja y reconexión de cuentas desde la interfaz.
- **FUERA DE ALCANCE (fases futuras):** social listening amplio (menciones en
  toda la web/redes), análisis de sentimiento, monitoreo de competencia.

---

## 2. Decisiones de arquitectura (NO cambiar sin justificar)

El sistema se compone de **tres piezas desacopladas**. Es fundamental no
mezclarlas:

1. **Recolector (collector / worker)**: habla con las APIs externas, respeta
   rate limits, y persiste snapshots en la base. NO corre en respuesta a
   peticiones normales del frontend — ver nota sobre Vercel más abajo.

2. **Base de datos (MongoDB)**: única fuente de verdad para el dashboard. Guarda
   el histórico. El frontend NUNCA consulta las APIs externas directamente.

3. **Admin / Dashboard (React + Vite)**: solo lee de la API interna del backend.
   Muestra gráficos y tablas. Cero lógica de integración con redes sociales acá.

### Dos momentos distintos del cliente de integración

El mismo cliente de integración (meta/x/tiktok) se usa en dos momentos que NO
hay que confundir:

- **Conexión inicial (interactiva, una vez por cuenta):** ocurre cuando el
  usuario hace clic en "Conectar cuenta" en el dashboard. Es el flujo OAuth: el
  backend redirige a la plataforma, el cliente autoriza con SU cuenta, y la
  plataforma devuelve los tokens. Esta lógica vive en la **API REST** (Express),
  porque necesita un humano del otro lado. El usuario nunca ve ni pega un token.

- **Recolección continua (automática, cada 6 h):** el recolector usa los tokens
  ya guardados para traer métricas sin intervención humana. Esta lógica vive en
  el **recolector**.

> Ambos momentos comparten el mismo módulo de integración, pero se invocan desde
> lugares distintos. El handshake OAuth = API REST. La extracción periódica = recolector.

### ⚠️ El recolector en producción NO corre solo (Vercel serverless)

El backend está deployado en **Vercel como función serverless**, no como un
proceso persistente. Esto cambia cómo se dispara el recolector:

- **En local** (`npm run dev`, sin `process.env.VERCEL`), `src/index.js` llama
  `iniciarRecolector()` y `node-cron` agenda `COLLECTOR_CRON` dentro del mismo
  proceso — funciona como en un servidor tradicional.
- **En Vercel**, `node-cron` nunca arranca (no hay proceso vivo entre requests).
  Por eso existe `GET|POST /api/collect` (`backend/src/api/collect.routes.js`):
  un endpoint que ejecuta un ciclo completo del recolector on-demand, protegido
  con `Authorization: Bearer <CRON_SECRET o COLLECTOR_SECRET>` (o un JWT de
  admin desde el botón del frontend).
- El **Vercel Cron nativo se sacó** (commit `ff609b6`) porque el plan Hobby no
  permite la frecuencia necesaria. La intención era pegarle a `/api/collect`
  desde **un cron externo** (ej. cron-job.org, GitHub Actions con `schedule`,
  etc.) cada `COLLECTOR_CRON` (6h).
- **Verificar antes de asumir que las métricas se actualizan solas:** confirmá
  que ese cron externo esté realmente configurado y pegándole al endpoint. Si
  no está, los snapshots no se generan y el dashboard queda con datos viejos
  sin ningún error visible.

```
                     ┌──────────────────────────────────────┐
                     │   APIs Meta / X / TikTok (OAuth)       │
                     └───▲───────────────▲──────────────┬────┘
        autoriza (1 vez)  │               │ snapshot (c/6h)│
                          │               │                │
   ┌──────────────┐  redirect      ┌──────┴───────┐        │
   │ React+Vite   │ ──────────────>│  API REST     │        │
   │ (dashboard)  │ <───── HTTP ───│  (Express)    │        │
   └──────────────┘                │  - OAuth/alta │        │
          ▲                        │  - lee datos  │        │
          │ lee (HTTP)             └──────┬────────┘        │
          │                               │ guarda tokens   │
          │                          ┌────▼─────┐    ┌───────▼──────┐
          └──────────────────────────┤  MySQL   │<───┤  Recolector  │
                                      │ (histor.)│    │   (worker)   │
                                      └──────────┘    └──────────────┘
```

### Regla de oro
> El frontend jamás llama directamente a Meta, X o TikTok: solo abre el flujo
> OAuth que sirve la API REST. La extracción periódica de datos la hace solo el
> recolector. El dashboard solo consume la API REST interna.

---

## 3. Stack tecnológico

| Capa            | Tecnología                                          |
|-----------------|------------------------------------------------------|
| Backend / API   | Node.js + Express (deployado como función serverless en Vercel) |
| Recolector      | Node.js + node-cron en local; en producción vía `GET/POST /api/collect` disparado por cron externo (ver sección 2) |
| Base de datos   | MongoDB (Atlas) + Mongoose                           |
| Frontend        | React + Vite (deployado en Vercel, proyecto separado)|
| Gráficos        | Recharts                                             |
| Auth            | JWT + bcrypt (login propio)                          |
| HTTP client     | axios                                                |
| Análisis de sentimiento | Claude Haiku (axios directo a api.anthropic.com), opcional vía `ANTHROPIC_API_KEY` |
| Orquestación    | Sin Docker — cada carpeta (`backend/`, `frontend/`) es un proyecto Vercel independiente, cada uno con su `vercel.json` |

> Nota de preferencia: comentarios de commits y de código en **español**.

---

## 4. Identidad visual

La estética se inspira en la **bandera federal argentina**: azul oscuro y blanco
como base, con el rojo reservado como acento. La interfaz es un **dashboard de
datos**, no una landing de marketing: prioriza legibilidad y lectura rápida de
estados por sobre el impacto visual.

### Paleta

| Rol | Color | Hex | Uso |
|-----|-------|-----|-----|
| Primario (azul oscuro) | azul noche | `#10204A` | barra lateral, header, navegación, títulos |
| Primario alt. | azul más profundo | `#0D1B3E` | hover/activo sobre el primario, fondos sólidos |
| Fondo de página | gris muy claro | `#F4F6FA` | fondo general (hace "flotar" las tarjetas) |
| Superficie | blanco | `#FFFFFF` | tarjetas de métricas, contenido, tablas |
| Texto principal | casi negro azulado | `#1A2238` | texto sobre fondos claros |
| Texto secundario | gris | `#6B7280` | subtítulos, labels, texto auxiliar |
| **Acento / negativo** | **rojo** | `#D62828` | alertas, métricas en baja, "token vencido", badges de atención |
| Positivo | verde | `#2E7D32` | "cuenta conectada", métricas en alza |
| Advertencia | ámbar | `#E0A106` | estados intermedios, avisos no críticos |

### Reglas de uso del color (IMPORTANTE)
- El **rojo es un acento**, no un color de relleno. Se usa SOLO para llamar la
  atención (estados negativos, alertas). Si aparece en todos lados pierde su
  función de "atención acá".
- El **azul oscuro** manda en la estructura (sidebar/header), pero el área de
  trabajo es clara (`#F4F6FA` con tarjetas blancas). No pintar grandes áreas de
  contenido de azul: cansa la vista en uso prolongado.
- **Semántica de estados de cuenta** (ligar a `connection_status` de la sección 6):
  verde = `conectada`; rojo = `token_vencido` / `error`; ámbar = `pendiente`;
  gris = `desconectada`.

### Tipografía
- **Montserrat** para toda la interfaz (coherente con otros proyectos del equipo).
  Pesos: 600/700 para títulos y números de métricas; 400/500 para texto.

### Tokens CSS sugeridos (`:root`)
```css
:root {
  --color-primario: #10204A;
  --color-primario-alt: #0D1B3E;
  --color-fondo: #F4F6FA;
  --color-superficie: #FFFFFF;
  --color-texto: #1A2238;
  --color-texto-secundario: #6B7280;
  --color-acento: #D62828;   /* rojo: solo acentos y estados negativos */
  --color-positivo: #2E7D32;
  --color-advertencia: #E0A106;
  --fuente-base: 'Montserrat', system-ui, sans-serif;
}
```

---

## 5. Estructura de carpetas propuesta

Estructura real (verificada, ago 2026):

```
radarsocial/
├── CLAUDE.md                  # este archivo
├── backend/
│   ├── vercel.json             # deploy serverless (proyecto Vercel "radarsocial")
│   ├── .env.example             # única fuente de verdad de variables de entorno
│   ├── package.json
│   └── src/
│       ├── index.js             # arranque de Express / handler serverless
│       ├── config/index.js      # lectura de env (jwt, port, urls, collectorCron)
│       ├── db/
│       │   ├── index.js         # conexión Mongoose vía MONGODB_URI
│       │   ├── migrate.js, seed.js, seed-demo.js, clear-demo.js, update-user.js
│       ├── auth/                # login JWT + middleware de roles
│       ├── api/                 # rutas REST que consume el frontend
│       │   ├── accounts.routes.js    # alta/baja/listado de cuentas
│       │   ├── oauth.routes.js       # inicio y callback del flujo OAuth
│       │   ├── metrics.routes.js
│       │   ├── posts.routes.js
│       │   ├── comments.routes.js
│       │   ├── analytics.routes.js   # tab "Análisis" (mejor hora, sentimiento, etc.)
│       │   ├── collect.routes.js     # dispara el recolector on-demand (cron externo / botón admin)
│       │   └── hashtags.routes.js    # búsqueda de hashtags en X, top 10 usuarios
│       ├── integrations/
│       │   ├── registry.js          # registro declarativo de plataformas (scopes, URLs)
│       │   ├── meta.client.js        # Facebook + Instagram (Graph API)
│       │   ├── x.client.js           # X / Twitter API
│       │   ├── sentiment.js          # análisis de sentimiento vía Claude Haiku
│       │   └── test-meta.js, test-x.js  # scripts de prueba manual aislados
│       ├── collector/
│       │   ├── collector.js         # orquestador (node-cron local / invocado por /api/collect en Vercel)
│       │   ├── meta.collector.js, x.collector.js
│       │   └── tokens.js            # refresco y cifrado AES-256-CBC de tokens OAuth
│       ├── models/                  # 6 schemas Mongoose (ver sección 6)
│       └── utils/logger.js
└── frontend/
    ├── vercel.json             # rewrites /api, /auth, /health hacia el backend
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx, App.jsx
        ├── api/                # clientes axios (auth, cuentas, metricas, posts, comentarios, analytics, hashtags)
        ├── components/Layout.jsx
        ├── pages/              # Login, Dashboard, Cuentas, DetalleCuenta, AnalisisTab, Legal
        └── auth/               # AuthContext, ProtectedRoute
```

> TikTok sigue sin cliente de integración (`tiktok.client.js` no existe todavía);
> las variables de entorno están reservadas pero no hay implementación.

---

## 6. Modelo de datos (Mongoose / MongoDB)

Seis modelos en `backend/src/models/`. Los campos `id/FK` de abajo son en
realidad `_id` de Mongo / `ObjectId` referenciado.

**`User`** — quién entra al admin
```
email (único), password_hash (bcrypt), role ('admin' | 'cliente'), created_at
```

**`SocialAccount`** — las cuentas que monitoreamos
```
platform ('facebook'|'instagram'|'x'|'tiktok'),
external_id (único por plataforma), handle, display_name,
access_token (CIFRADO AES-256-CBC), refresh_token (CIFRADO),
token_expires_at,
connection_status ('pendiente'|'conectada'|'token_vencido'|'error'|'desconectada'),
connection_method ('oauth'|'manual'|'publica'),  # publica = cuenta X pública sin OAuth
connected_by (FK User), connected_at,
last_error,
created_at, updated_at
```
> `connection_status` es lo que el dashboard muestra para que el usuario sepa
> si una cuenta está sana o necesita reconectarse.

**`OAuthState`** — seguridad del flujo OAuth (anti-CSRF)
```
state (único), platform, user_id (FK),
code_verifier,   # PKCE, obligatorio para X
expires_at + índice TTL (auto-borra a los 10 min)
```
> Al iniciar OAuth se genera un `state` aleatorio que se valida en el callback.
> Evita que un tercero complete una autorización falsa.

**`AccountSnapshot`** — la métrica histórica (el corazón del sistema)
```
social_account_id (FK), snapshot_date ('YYYY-MM-DD'),
followers, following, posts_count,
reach, impressions, engagement_rate,
índice único: { social_account_id, snapshot_date }
```
> Un snapshot por cuenta por día. Esto permite graficar tendencias.

**`Post`** — publicaciones individuales
```
social_account_id (FK), external_post_id (único por cuenta),
type ('foto'|'video'|'reel'|'texto'), content_preview, url, published_at,
likes, comments_count, shares, views, last_updated_at
```

**`Comment`** — comentarios sobre publicaciones propias
```
post_id (FK), external_comment_id (único por post),
author_handle, content, sentiment (null | analizado vía Claude Haiku),
published_at, captured_at
```
> Nota: la búsqueda de hashtags en X (sección "Tab Análisis"/`hashtags.routes.js`)
> NO persiste nada — es una consulta on-demand a la API de X que se descarta.

---

## 7. Variables de entorno

**Única fuente de verdad:** `backend/.env.example` (no hay `.env.example` en la
raíz — se borró por quedar desactualizado con variables MySQL que ya no existen).

```dotenv
# --- Base de datos ---
MONGODB_URI=mongodb+srv://USUARIO:CONTRASEÑA@cluster.mongodb.net/radar_social

# --- Seguridad ---
JWT_SECRET=cambiar_por_string_random_de_64_caracteres
TOKEN_ENCRYPTION_KEY=cambiar_por_string_random_de_32_caracteres

# --- URLs ---
FRONTEND_URL=https://larioja.navegamisitio.com.ar
BACKEND_URL=https://radarsocial.navegamisitio.com.ar
PORT=3000

# --- Meta (Facebook + Instagram) ---
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://radarsocial.navegamisitio.com.ar/auth/meta/callback
META_CONFIG_ID=            # ID de la Login Configuration del portal de Meta

# --- X (Twitter) — OAuth 2.0 con PKCE ---
X_CLIENT_ID=
X_CLIENT_SECRET=
X_BEARER_TOKEN=            # para búsqueda pública de cuentas + búsqueda de hashtags
X_REDIRECT_URI=https://radarsocial.navegamisitio.com.ar/auth/x/callback

# --- TikTok (reservado, sin implementar) ---
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=

# --- Análisis de sentimiento (opcional) ---
ANTHROPIC_API_KEY=         # si falta, la feature queda deshabilitada sin romper nada más

# --- Recolector ---
COLLECTOR_CRON=0 */6 * * *          # usado solo por node-cron en local
COLLECTOR_SECRET=                    # para disparar /api/collect manualmente por curl
# CRON_SECRET lo genera Vercel automáticamente si se configura un Cron Job — no se setea a mano
```

> El proxy del frontend (`frontend/vercel.json`) apunta directo a la URL de
> Vercel del backend (`https://radarsocial-five.vercel.app`), no al dominio
> custom. El dominio `radarsocial.navegamisitio.com.ar` es el que hay que
> registrar como redirect URI en los portales de Meta/X (así está en el .env),
> pero verificar en el dashboard de Vercel que siga apuntando al mismo deploy
> si algo de OAuth empieza a fallar.

---

## 8. Notas críticas sobre las APIs (LEER ANTES DE PROGRAMAR)

Esta sección documenta las trampas conocidas de cada plataforma. El acceso a
las APIs es el verdadero cuello de botella del proyecto.

### Meta (Facebook + Instagram) — Graph API
- Instagram debe ser cuenta **Business o Creator**, vinculada a una Página de Facebook.
- Requiere crear app en **Meta for Developers** y pasar **App Review** para
  permisos como `instagram_basic`, `pages_read_engagement`, `instagram_manage_insights`.
- Tokens de larga duración: **caducan a los ~60 días**. HAY que refrescarlos.
- Es la plataforma más viable de las cuatro para cuentas autorizadas.

### X (Twitter) — API v2
- **Punto más frágil del proyecto.** El free tier es muy limitado en llamadas.
- Verificar EN UNA PRUEBA MANUAL (Postman/curl) que el tier disponible alcanza
  ANTES de programar la integración. Si no alcanza, evaluar plan pago o descartar X.

### TikTok — Display API
- Acceso orientado a la cuenta propia autenticada. Requiere registro de app y
  aprobación. Verificar qué métricas devuelve realmente para cuentas de negocio.

### Regla transversal sobre tokens
- Guardar `access_token` y `refresh_token` **cifrados** en la base (usar
  `TOKEN_ENCRYPTION_KEY`).
- El recolector debe revisar `token_expires_at` y refrescar ANTES de que venza.
- Si un token vence sin refrescarse, marcar la cuenta como `token_vencido` y
  avisar en el dashboard, en vez de fallar en silencio.

---

## 9. Gestión de cuentas desde el admin (alta por OAuth)

El usuario da de alta cada cuenta desde la interfaz, sin manipular tokens. El
flujo es siempre el mismo y cambia solo en los detalles por plataforma.

### Flujo de conexión (paso a paso)
1. En el dashboard, el usuario va a "Cuentas" y elige una plataforma
   (Facebook, Instagram, X, TikTok).
2. El frontend pide a la API REST iniciar la conexión para esa plataforma.
3. La API genera un `state` (guardado en `oauth_states`) y devuelve la URL de
   autorización de la plataforma, con los **scopes** correspondientes.
4. El usuario es redirigido a la plataforma, se loguea con SU cuenta y autoriza.
5. La plataforma redirige al **callback** de la API con un `code` y el `state`.
6. La API valida el `state`, intercambia el `code` por tokens, identifica la
   cuenta (external_id, handle), cifra y guarda los tokens, y marca la cuenta
   como `conectada`.
7. El usuario vuelve al dashboard y ve la cuenta lista para monitorear.

### Registro de plataformas (`integrations/registry.js`)

La frase "dependiendo de la plataforma te pide los datos que necesita" se
resuelve con una estructura declarativa única. Cada plataforma define qué pide
y cómo, y tanto el frontend como la API leen de ahí (sin duplicar lógica):

```js
// Forma orientativa — ajustar con los valores reales tras el Paso 0.
export const PLATFORMS = {
  instagram: {
    label: 'Instagram',
    method: 'oauth',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: ['instagram_basic', 'instagram_manage_insights', 'pages_read_engagement'],
    requires: ['Cuenta Business o Creator vinculada a una Página de Facebook'],
  },
  facebook: {
    label: 'Facebook',
    method: 'oauth',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: ['pages_read_engagement', 'read_insights'],
    requires: ['Ser admin de la Página'],
  },
  x: {
    label: 'X (Twitter)',
    method: 'oauth',           // o 'manual' si el tier no alcanza (ver Paso 0)
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    requires: ['Plan de API que permita las lecturas necesarias'],
  },
  tiktok: {
    label: 'TikTok',
    method: 'oauth',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: ['user.info.basic', 'video.list'],
    requires: ['Cuenta compatible con la Display API'],
  },
};
```

- El **frontend** usa `label` y `requires` para mostrar al usuario qué hace
  falta antes de conectar, y para pintar el botón correcto por plataforma.
- La **API** usa `authUrl` y `scopes` para construir la URL de autorización.
- Si una plataforma no soporta OAuth para el caso (posible con X según el tier),
  se pone `method: 'manual'` y el frontend muestra un formulario de respaldo
  para pegar los datos a mano. El resto del sistema no cambia.

### Operaciones de la pantalla "Cuentas"
- **Conectar** una cuenta nueva (inicia el flujo OAuth).
- **Ver estado** de cada cuenta (`connection_status` + `last_error`).
- **Reconectar** una cuenta con `token_vencido` (re-dispara OAuth).
- **Desconectar / eliminar** una cuenta (deja de recolectarse).
- Restringido por rol: definir si el cliente puede conectar cuentas o solo el admin.

---

## 10. Convenciones de código

- Comentarios y mensajes de commit en **español**.
- Manejo de errores explícito en todas las llamadas a APIs externas (try/catch,
  logging claro). Nunca asumir que una API externa responde bien.
- Respetar rate limits: el recolector procesa cuentas con pausas, no en ráfaga.
- Secretos solo vía variables de entorno, nunca hardcodeados ni commiteados.
- El frontend no contiene NINGUNA credencial de las APIs sociales.

---

## 11. Secuencia de construcción original (histórico — ya completado salvo TikTok)

> Esta sección documenta el plan con el que arrancó el proyecto. Los pasos 1–9
> **ya están construidos** (con MongoDB/Vercel en vez de MySQL/Docker, ver
> secciones 2–3). Se deja como referencia de las dependencias entre piezas, y
> porque el **Prompt 10 (TikTok) sigue pendiente**. Además del plan original ya
> se sumaron: búsqueda de hashtags en X (`hashtags.routes.js`), disparo del
> recolector on-demand (`collect.routes.js`, necesario por el modelo serverless
> de Vercel) y análisis de sentimiento con Claude Haiku (`analytics.routes.js`,
> `integrations/sentiment.js`).

Construir en este orden respeta las dependencias. No saltear pasos.

> **Paso 0 (manual, sin código):** Resolver el acceso a las APIs. Crear cuentas
> de developer en Meta, X y TikTok, registrar apps, obtener credenciales y
> probar con Postman/curl que se pueden traer los datos. **Confirmar que X
> funciona con el tier disponible antes de seguir.**

**Prompt 1 — Esqueleto e infraestructura**
> "Creá la estructura base del proyecto según el CLAUDE.md: docker-compose con
> MySQL, backend Node+Express y frontend React+Vite. Generá el .env.example y
> un health-check en el backend. Que `docker compose up` levante todo."

**Prompt 2 — Base de datos y migraciones**
> "Implementá el modelo de datos de la sección 6 con migraciones. Configurá la
> conexión a MySQL y un seed con un usuario admin de prueba."

**Prompt 3 — Autenticación**
> "Implementá login con JWT y bcrypt, y middleware de roles (admin / cliente)
> según la sección 6. Endpoints de login y verificación de sesión."

**Prompt 4 — Cliente de integración Meta (empezar por la más viable)**
> "Implementá `meta.client.js` para traer métricas, publicaciones y comentarios
> de una cuenta de Instagram/Facebook Business vía Graph API. Incluí el refresco
> de tokens de larga duración. Probalo de forma aislada con un script."

**Prompt 5 — Registro de plataformas y flujo OAuth (alta de cuentas)**
> "Implementá `integrations/registry.js` con la estructura de la sección 9 y las
> rutas `oauth.routes.js`: iniciar conexión (genera y guarda el `state`, devuelve
> la URL de autorización con los scopes de la plataforma) y el callback (valida
> `state`, intercambia el `code` por tokens, identifica la cuenta, cifra y guarda
> los tokens, marca la cuenta como `conectada`). Por ahora solo Meta."

**Prompt 6 — Pantalla "Cuentas" en el frontend**
> "Implementá la página de gestión de cuentas: listar cuentas con su
> `connection_status`, botón de conectar por plataforma (leyendo el registro y
> mostrando los `requires`), reconexión de cuentas vencidas y baja de cuentas.
> Rutas protegidas según rol."

**Prompt 7 — El recolector**
> "Implementá el collector con node-cron que, según COLLECTOR_CRON, recorra las
> cuentas con `connection_status = 'conectada'`, llame a los clientes de
> integración y guarde snapshots, posts y comentarios. Con manejo de rate limits,
> refresco de tokens y marcado de cuentas con token vencido."

**Prompt 8 — API REST interna (lectura de datos)**
> "Implementá las rutas REST (metrics, posts, comments) que lee el frontend desde
> la base. Con paginación y filtros por rango de fechas."

**Prompt 9 — Dashboard React**
> "Implementá el dashboard: login, vista general con cards de métricas por
> cuenta, gráficos de tendencia con Recharts, y detalle por cuenta con sus
> publicaciones y comentarios. Rutas protegidas según rol. Aplicá la identidad
> visual de la sección 4 (paleta de la bandera federal, tokens CSS, Montserrat)
> y mostrá 'Radar Social La Rioja' en el header."

**Prompt 10 — Resto de integraciones**
> "Implementá `x.client.js` y `tiktok.client.js` siguiendo el patrón de
> meta.client.js, agregalas al registro de plataformas y al recolector." (Solo si
> el Paso 0 confirmó que son viables; usar `method: 'manual'` en el registro para
> las que no soporten OAuth en el caso.)
>
> **Estado (ago 2026): X ya está implementado (`x.client.js`, OAuth2+PKCE,
> `connection_method: 'publica'` como respaldo sin OAuth). Solo falta TikTok
> — `tiktok.client.js` no existe todavía, es el único ítem pendiente del plan
> original.**

---

## 12. Recordatorios para Claude Code

- Antes de escribir una integración, preguntá si ya se hizo la prueba manual
  de esa API (Paso 0). No tiene sentido programar contra una API que no se sabe
  si da acceso.
- Mantené las tres piezas (recolector / DB / dashboard) desacopladas.
- En el flujo OAuth: validar SIEMPRE el `state` en el callback antes de
  intercambiar el `code`. Nunca exponer `access_token` ni `refresh_token` al
  frontend; quedan solo en el backend, cifrados en la base.
- Ante la duda sobre el formato real de una respuesta de API, pedí un ejemplo
  de respuesta real en vez de inventar la estructura.
- El backend corre serverless en Vercel: nunca asumas que hay un proceso
  persistente entre requests (nada de estado en memoria entre llamadas, y el
  `node-cron` de `iniciarRecolector()` solo aplica en local — ver sección 2).
- Último commit: `94067e6` (2026-06-12). Antes de tocar algo, revisar si el
  cron externo que dispara `/api/collect` sigue configurado y corriendo.
